import { geoGraticule, geoMercator, geoPath } from "d3-geo";
import type { Feature, MultiPoint } from "geojson";
import { useMemo } from "react";
import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { MapBase } from "./MapBase";
import { type Bounds, useMapLayers, visible } from "./mapData";
import { sideColor, theme } from "./theme";
import type { SceneMap } from "./types";

const WIDTH = 1920;
const HEIGHT = 1080;

// Warna lapisan alam: air lebih terang dari laut agar sungai terbaca di daratan.
const WATER = "#4f7188";
const SHALLOW = ["#26394a", "#2e4556"];
const BORDER = "#6b5a3e";
const PLACE = "#3b2f22";

// Area peta lebih kecil dari ini (derajat) memakai data resolusi tinggi (10m).
const DETAIL_SPAN = 3;

// Area tampilan: kotak yang memuat semua titik ditambah margin. Pertempuran
// tingkat kota tampil dekat; wilayah luas tampil utuh. Titik yang terpisah
// lebih dari 180° bujur (misalnya Tokyo dan Pearl Harbor) dilihat lewat garis
// 180°, bukan memutar setengah dunia; `center` menjadi pusat rotasi proyeksi.
function viewBox(points: SceneMap["points"]): Feature<MultiPoint> & { span: number; center: number } {
  const raw = points.map((p) => p.lng);
  const crosses = Math.max(...raw) - Math.min(...raw) > 180;
  const lngs = crosses ? raw.map((lng) => (lng < 0 ? lng + 360 : lng)) : raw;
  const lats = points.map((p) => p.lat);
  const pad = (min: number, max: number, minSpan: number) => {
    const span = Math.max(max - min, minSpan);
    const mid = (min + max) / 2;
    return [mid - span * 0.75, mid + span * 0.75];
  };
  const [west, east] = pad(Math.min(...lngs), Math.max(...lngs), 0.6);
  const [south, north] = pad(Math.min(...lats), Math.max(...lats), 0.4);
  return {
    type: "Feature",
    properties: {},
    span: Math.max(east - west, north - south),
    center: (west + east) / 2,
    geometry: {
      type: "MultiPoint",
      coordinates: [
        [west, south],
        [east, north],
      ],
    },
  };
}

// Sungai dan danau kecil (rank besar) hanya tampil saat peta diperbesar.
const maxWaterRank = (span: number) => (span > 40 ? 3 : span > 15 ? 5 : span > 5 ? 7 : 10);

// Jarak garis lintang/bujur yang enak dibaca untuk luas area tertentu.
function graticuleStep(span: number) {
  return [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30].find((step) => step >= span / 6) ?? 30;
}

const LABEL_FONT = 38;
const PLACE_FONT = 26;
const MAX_PLACES = 8;

type Box = { x0: number; y0: number; x1: number; y1: number };
type Point = [number, number];

const overlapsAny = (b: Box, boxes: Box[]) =>
  boxes.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);

// Posisi label tiap titik: di atas, bawah, kanan, atau kiri, dipilih yang
// tidak bertumpuk dengan label atau penanda lain.
function placeLabels(projected: Point[], labels: string[]) {
  const placed: Box[] = projected.map(([x, y]) => ({ x0: x - 16, y0: y - 16, x1: x + 16, y1: y + 16 }));
  const choices = projected.map(([x, y], i) => {
    const w = labels[i].length * LABEL_FONT * 0.5;
    const h = LABEL_FONT;
    const options = [
      { x, y: y - 26, anchor: "middle" as const, box: { x0: x - w / 2, y0: y - 26 - h, x1: x + w / 2, y1: y - 26 } },
      { x, y: y + 56, anchor: "middle" as const, box: { x0: x - w / 2, y0: y + 56 - h, x1: x + w / 2, y1: y + 56 } },
      { x: x + 26, y: y + 13, anchor: "start" as const, box: { x0: x + 26, y0: y - 20, x1: x + 26 + w, y1: y + 18 } },
      { x: x - 26, y: y + 13, anchor: "end" as const, box: { x0: x - 26 - w, y0: y - 20, x1: x - 26, y1: y + 18 } },
    ];
    const choice = options.find((o) => !overlapsAny(o.box, placed)) ?? options[0];
    placed.push(choice.box);
    return choice;
  });
  return { choices, placed };
}

// Keterangan peta dan legenda pihak di kiri atas; kota konteks tidak ditaruh di sana.
const CAPTION_AREA: Box = { x0: 0, y0: 0, x1: 900, y1: 290 };

// Kota di sekitar sebagai konteks (Natural Earth): yang paling penting lebih
// dulu, tidak terlalu dekat dengan titik naskah dan tidak menabrak label lain.
function pickPlaces(
  places: { name: string; x: number; y: number }[],
  mainPoints: Point[],
  mainNames: string[],
  taken: Box[],
) {
  const names = new Set(mainNames.map((n) => n.toLowerCase()));
  const boxes = [...taken, CAPTION_AREA];
  const chosen: { name: string; x: number; y: number }[] = [];
  for (const place of places) {
    if (chosen.length >= MAX_PLACES) break;
    const { x, y } = place;
    if (x < 60 || x > WIDTH - 60 || y < 60 || y > HEIGHT - 60) continue;
    if (names.has(place.name.toLowerCase())) continue;
    if (mainPoints.some(([px, py]) => Math.hypot(px - x, py - y) < 70)) continue;
    // Diberi jarak 10 px agar tidak menempel pada label lain.
    const box = { x0: x - 18, y0: y - PLACE_FONT - 10, x1: x + 24 + place.name.length * PLACE_FONT * 0.5, y1: y + 20 };
    if (overlapsAny(box, boxes)) continue;
    boxes.push(box);
    chosen.push(place);
  }
  return chosen;
}

// Titik pada kurva kuadratik dan arah garis singgungnya, untuk panah melengkung.
function quadratic(a: Point, c: Point, b: Point, t: number) {
  const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0];
  const y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1];
  const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
  const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
  return { x, y, angle: Math.atan2(dy, dx) };
}

const HEAD_LENGTH = 46;
const HEAD_WIDTH = 60;

// Bentuk panah gerak pasukan ala peta militer: badan melengkung yang melebar
// ke arah kepala panah, tergambar sampai `progress`.
function arrowShape(from: Point, to: Point, progress: number) {
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const control: Point = [
    (from[0] + to[0]) / 2 - ((to[1] - from[1]) / length) * length * 0.18,
    (from[1] + to[1]) / 2 + ((to[0] - from[0]) / length) * length * 0.18,
  ];
  // Ujung panah berhenti sedikit sebelum titik tujuan agar tidak menutupi penanda.
  const end = Math.min(progress, 1) * 0.93;
  const steps = 32;
  const samples = Array.from({ length: steps + 1 }, (_, i) => quadratic(from, control, to, (end * i) / steps));
  const tip = samples[samples.length - 1];
  // Badan berhenti di pangkal kepala panah.
  // Panah pendek (misalnya antarbagian kota) diperkecil agar kepalanya tidak menelan badan.
  const scale = Math.min(1, length / 240);
  const headLength = HEAD_LENGTH * Math.max(0.45, scale);
  const headWidth = HEAD_WIDTH * Math.max(0.45, scale);
  const body = samples.filter((p) => Math.hypot(tip.x - p.x, tip.y - p.y) >= headLength);
  if (body.length < 2) return null;
  const base = { x: tip.x - Math.cos(tip.angle) * headLength, y: tip.y - Math.sin(tip.angle) * headLength };
  const side = (p: { x: number; y: number; angle: number }, half: number, sign: number) =>
    `${p.x - Math.sin(p.angle) * half * sign},${p.y + Math.cos(p.angle) * half * sign}`;
  const halfWidth = (i: number) => (5 + (i / (body.length - 1)) * 9) * Math.max(0.6, scale);
  const left = body.map((p, i) => side(p, halfWidth(i), 1));
  const right = body.map((p, i) => side(p, halfWidth(i), -1)).reverse();
  const baseAngle = { ...base, angle: tip.angle };
  const head = [side(baseAngle, headWidth / 2, 1), `${tip.x},${tip.y}`, side(baseAngle, headWidth / 2, -1)];
  return [...left, ...head, ...right].join(" ");
}

function Arrow({ from, to, color, progress }: { from: Point; to: Point; color: string; progress: number }) {
  if (progress <= 0) return null;
  const shape = arrowShape(from, to, progress);
  if (!shape) return null;
  return (
    <g>
      <polygon points={shape} fill="#000" opacity={0.3} transform="translate(5 7)" />
      <polygon points={shape} fill={color} stroke="#1b140c" strokeWidth={2.5} strokeLinejoin="round" />
    </g>
  );
}

// Lingkaran yang memancar dari titik tujuan saat panah tiba.
function ArrivalPulse({ at, color, progress }: { at: Point; color: string; progress: number }) {
  if (progress <= 0 || progress >= 1) return null;
  return (
    <circle
      cx={at[0]}
      cy={at[1]}
      r={16 + progress * 60}
      fill="none"
      stroke={color}
      strokeWidth={5}
      opacity={1 - progress}
    />
  );
}

// Tekstur daratan: bercak besar seperti relief ditambah butiran halus seperti kertas peta.
const LAND_TEXTURE = `<filter id="t" x="0" y="0" width="100%" height="100%">
<feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="3" seed="7" result="relief"/>
<feColorMatrix in="relief" type="matrix" values="0 0 0 0 0.35 0 0 0 0 0.27 0 0 0 0 0.16 0 0 0 -1.1 0.62" result="reliefTint"/>
<feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="1" seed="3" result="grain"/>
<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0.2 0 0 0 0 0.15 0 0 0 0 0.08 0 0 0 0.22 0" result="grainTint"/>
<feMerge result="texture"><feMergeNode in="reliefTint"/><feMergeNode in="grainTint"/></feMerge>
<feComposite in="texture" in2="SourceGraphic" operator="in" result="textureOnLand"/>
<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="textureOnLand"/></feMerge>
</filter>`;

// Markup SVG lapisan statis untuk MapBase: laut, grid lintang/bujur, air
// dangkal di pantai (lebih tipis di peta luas agar pulau kecil tidak
// menggelembung), daratan bertekstur, danau, sungai, dan batas negara.
function baseSvg(
  d: { graticule: string; land: string; lakes: string; borders: string; rivers: { width: number; d: string }[] },
  shore: number,
) {
  const rivers = d.rivers
    .map(
      (r) =>
        `<path d="${r.d}" fill="none" stroke="${WATER}" stroke-width="${r.width}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
<defs>${LAND_TEXTURE}</defs>
<rect width="${WIDTH}" height="${HEIGHT}" fill="${theme.sea}"/>
<path d="${d.graticule}" fill="none" stroke="#ffffff" stroke-opacity="0.07" stroke-width="1.5"/>
<path d="${d.land}" fill="none" stroke="${SHALLOW[0]}" stroke-width="${shore * 2.2}" stroke-linejoin="round"/>
<path d="${d.land}" fill="none" stroke="${SHALLOW[1]}" stroke-width="${shore}" stroke-linejoin="round"/>
<path d="${d.land}" fill="${theme.land}" stroke="${theme.landEdge}" stroke-width="1.5" filter="url(#t)"/>
<path d="${d.lakes}" fill="${theme.sea}" stroke="${WATER}" stroke-width="1.5"/>
${rivers}
<path d="${d.borders}" fill="none" stroke="${BORDER}" stroke-width="2" stroke-dasharray="10 7" opacity="0.8"/>
</svg>`;
}

// F-29: peta animasi. Daratan, batas negara, sungai, danau, dan kota konteks
// dari Natural Earth; zona kekuasaan muncul lebih dulu, lalu titik bergantian,
// rute, dan panah gerak pasukan satu per satu sepanjang adegan.
// Warna mengikuti pihak (sides): merah, biru, emas.
export function MapLayer({ map }: { map: SceneMap }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const box = useMemo(() => viewBox(map.points), [map.points]);
  const layers = useMapLayers(box.span < DETAIL_SPAN);

  const drawn = useMemo(() => {
    const projection = geoMercator()
      .rotate([-box.center, 0])
      .fitExtent(
        [
          [140, 160],
          [WIDTH - 140, HEIGHT - 200],
        ],
        box,
      );
    const path = geoPath(projection);
    // Wilayah geografis yang benar-benar terlihat di layar 1920×1080.
    const topLeft = projection.invert?.([0, 0]) ?? [0, 0];
    const bottomRight = projection.invert?.([WIDTH, HEIGHT]) ?? [0, 0];
    const view: Bounds = [
      [topLeft[0], bottomRight[1]],
      [bottomRight[0], topLeft[1]],
    ];
    const projected = map.points.map((p) => (projection([p.lng, p.lat]) ?? [WIDTH / 2, HEIGHT / 2]) as Point);
    // Jari-jari zona dalam piksel: jarak ke titik sejauh radiusKm ke utara.
    const zoneRadius = (map.zones ?? []).map((zone) => {
      const center = map.points[zone.point];
      if (!center) return 0;
      const edge = projection([center.lng, center.lat + zone.radiusKm / 111]);
      return edge ? Math.abs(edge[1] - projected[zone.point][1]) : 0;
    });
    const { choices: labels, placed } = placeLabels(
      projected,
      map.points.map((p) => p.label),
    );

    const collection = <T extends { feature: Feature }>(shapes: T[]) =>
      path({ type: "FeatureCollection", features: shapes.map((s) => s.feature) }) ?? "";
    const rankLimit = maxWaterRank(box.span);
    const rivers = layers ? visible(layers.rivers, view).filter((r) => r.rank <= rankLimit) : [];
    const [west, south] = view[0];
    const [east, north] = view[1];
    // Area yang melintasi garis 180° punya west > east.
    const inLng = (lng: number) => (west <= east ? lng >= west && lng <= east : lng >= west || lng <= east);
    const places = layers
      ? layers.places
          .filter((p) => inLng(p.lng) && p.lat >= south && p.lat <= north)
          .map((p) => {
            const [x, y] = projection([p.lng, p.lat]) ?? [-1, -1];
            return { name: p.name, x, y };
          })
      : [];

    return {
      projected,
      zoneRadius,
      labels,
      land: layers ? collection(visible(layers.islands, view)) : "",
      lakes: layers ? collection(visible(layers.lakes, view).filter((l) => l.rank <= rankLimit)) : "",
      borders: layers ? collection(visible(layers.borders, view)) : "",
      // Sungai besar (rank kecil) digambar lebih tebal.
      rivers: [
        { width: 4, d: collection(rivers.filter((r) => r.rank <= 2)) },
        { width: 3, d: collection(rivers.filter((r) => r.rank > 2 && r.rank <= 5)) },
        { width: 2, d: collection(rivers.filter((r) => r.rank > 5)) },
      ],
      graticule: path(geoGraticule().step([graticuleStep(box.span), graticuleStep(box.span)])()) ?? "",
      places: pickPlaces(
        places,
        projected,
        map.points.map((p) => p.label),
        placed,
      ),
    };
  }, [box, layers, map.points, map.zones]);
  const { projected, zoneRadius, labels } = drawn;
  const shore = box.span > 40 ? 6 : box.span > 10 ? 12 : 20;
  const base = useMemo(() => (layers ? baseSvg(drawn, shore) : null), [layers, drawn, shore]);

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.07]);
  const stagger = Math.max(6, Math.min(18, Math.floor((durationInFrames * 0.4) / Math.max(1, map.points.length))));
  const appear = (i: number) => spring({ frame: frame - 10 - i * stagger, fps, config: { damping: 14 } });
  const pointsDone = 10 + stagger * map.points.length;
  const baseIn = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" });

  const routeLength = projected.reduce(
    (sum, [x, y], i) => (i === 0 ? 0 : sum + Math.hypot(x - projected[i - 1][0], y - projected[i - 1][1])),
    0,
  );
  const routeProgress = interpolate(frame, [10, 10 + stagger * Math.max(1, projected.length - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Panah bergerak satu per satu, dibagi rata dari setelah titik muncul sampai
  // menjelang akhir adegan, agar setiap gerak pasukan sempat terbaca.
  const arrows = (map.arrows ?? []).filter((a) => projected[a.from] && projected[a.to] && a.from !== a.to);
  const arrowsStart = Math.min(pointsDone, durationInFrames * 0.3);
  const arrowSlot = (durationInFrames * 0.85 - arrowsStart) / Math.max(1, arrows.length);
  const arrowDraw = Math.max(18, Math.min(45, arrowSlot * 0.8));
  const arrowProgress = (i: number) => {
    const start = arrowsStart + i * arrowSlot;
    return interpolate(frame, [start, start + arrowDraw], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    });
  };
  const pulseProgress = (i: number) => {
    const start = arrowsStart + i * arrowSlot + arrowDraw;
    return interpolate(frame, [start, start + 24], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };

  const captionIn = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const sides = map.sides ?? [];

  const zoomStyle = { transform: `scale(${zoom})`, transformOrigin: "50% 50%" };

  return (
    <AbsoluteFill style={{ backgroundColor: theme.sea }}>
      {base && <MapBase svg={base} width={WIDTH} height={HEIGHT} style={zoomStyle} />}
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="75%">
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
        </defs>
        <g style={zoomStyle}>
          <g opacity={baseIn}>
            {drawn.places.map((place) => (
              <g key={place.name} opacity={0.8}>
                <circle cx={place.x} cy={place.y} r={5} fill={PLACE} />
                <text
                  x={place.x + 12}
                  y={place.y + 9}
                  fontFamily={theme.sans}
                  fontSize={PLACE_FONT}
                  fontWeight={600}
                  fill={PLACE}
                  stroke="#e9dcc2"
                  strokeWidth={5}
                  paintOrder="stroke"
                >
                  {place.name}
                </text>
              </g>
            ))}
          </g>
          {(map.zones ?? []).map((zone, i) => {
            const center = projected[zone.point];
            if (!center || !zoneRadius[i]) return null;
            const grow = spring({ frame: frame - 4 - i * 6, fps, config: { damping: 200 } });
            return (
              <circle
                key={`zone-${i}`}
                cx={center[0]}
                cy={center[1]}
                r={zoneRadius[i] * grow}
                fill={sideColor(zone.side)}
                fillOpacity={0.28}
                stroke={sideColor(zone.side)}
                strokeWidth={4}
                strokeDasharray="14 10"
              />
            );
          })}
          {map.route && projected.length > 1 && (
            <polyline
              points={projected.map(([x, y]) => `${x},${y}`).join(" ")}
              fill="none"
              stroke={theme.marker}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={routeLength}
              strokeDashoffset={routeLength * (1 - routeProgress)}
            />
          )}
          {arrows.map((arrow, i) => (
            <Arrow
              key={`arrow-${i}`}
              from={projected[arrow.from]}
              to={projected[arrow.to]}
              color={sideColor(arrow.side)}
              progress={arrowProgress(i)}
            />
          ))}
          {arrows.map((arrow, i) => (
            <ArrivalPulse
              key={`pulse-${i}`}
              at={projected[arrow.to]}
              color={sideColor(arrow.side)}
              progress={pulseProgress(i)}
            />
          ))}
          {projected.map(([x, y], i) => {
            const s = appear(i);
            return (
              <g key={map.points[i].label + i} opacity={Math.min(1, s)}>
                <circle cx={x} cy={y} r={14 * s} fill={sideColor(map.points[i].side)} stroke="#fff" strokeWidth={3} />
                <text
                  x={labels[i].x}
                  y={labels[i].y}
                  textAnchor={labels[i].anchor}
                  fontFamily={theme.sans}
                  fontSize={LABEL_FONT}
                  fontWeight={700}
                  fill="#1b140c"
                  stroke="#f3e6cf"
                  strokeWidth={8}
                  paintOrder="stroke"
                >
                  {map.points[i].label}
                </text>
              </g>
            );
          })}
        </g>
        <rect width={WIDTH} height={HEIGHT} fill="url(#map-vignette)" />
      </svg>
      {map.caption && (
        <div
          style={{
            position: "absolute",
            top: 64,
            left: 72,
            padding: "14px 28px",
            background: theme.panel,
            borderLeft: `4px solid ${theme.goldStrong}`,
            color: theme.ink,
            fontFamily: theme.sans,
            fontWeight: 700,
            fontSize: 40,
            opacity: captionIn,
            transform: `translateX(${interpolate(captionIn, [0, 1], [-30, 0])}px)`,
          }}
        >
          {map.caption}
        </div>
      )}
      {sides.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: 150,
            left: 72,
            padding: "12px 24px",
            background: theme.panel,
            fontFamily: theme.sans,
            fontSize: 30,
            color: theme.ink,
            opacity: captionIn,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {sides.map((side, i) => (
            <div key={side} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 22, height: 22, borderRadius: 4, background: sideColor(i) }} />
              {side}
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
}
