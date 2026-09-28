import { geoArea, geoBounds, geoMercator, geoPath } from "d3-geo";
import type { Feature, FeatureCollection, MultiPoint, Polygon } from "geojson";
import { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land50 from "world-atlas/land-50m.json";
import { sideColor, theme } from "./theme";
import type { SceneMap } from "./types";

const WIDTH = 1920;
const HEIGHT = 1080;

type LandTopology = Topology<{ land: GeometryCollection }>;
type Island = { feature: Feature<Polygon>; bounds: [[number, number], [number, number]] };

// Daratan dipecah per pulau/benua beserta kotak batasnya, agar hanya yang
// terlihat yang diproyeksikan. (Memotong seluruh daratan dunia dengan
// clipExtent membuat peta yang diperbesar terisi penuh warna daratan.)
function toIslands(topology: unknown): Island[] {
  const t = topology as LandTopology;
  const land = feature(t, t.objects.land) as FeatureCollection | Feature;
  const features = "features" in land ? land.features : [land];
  return features.flatMap((f) => {
    const g = f.geometry;
    const polygons = g.type === "MultiPolygon" ? g.coordinates : g.type === "Polygon" ? [g.coordinates] : [];
    return polygons.map((rings) => {
      let polygon: Feature<Polygon> = {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: rings },
      };
      // Poligon yang arah titiknya terbalik dianggap d3 sebagai seluruh bumi
      // kecuali pulau itu (luas > setengah bola); balikkan arahnya.
      if (geoArea(polygon) > 2 * Math.PI) {
        const reversed = rings.map((ring) => [...ring].reverse());
        polygon = { ...polygon, geometry: { type: "Polygon", coordinates: reversed } };
      }
      return { feature: polygon, bounds: geoBounds(polygon) as Island["bounds"] };
    });
  });
}
const land50Islands = toIslands(land50);

function visibleIslands(islands: Island[], [[west, south], [east, north]]: [[number, number], [number, number]]) {
  const mx = (east - west) * 0.5;
  const my = (north - south) * 0.5;
  return islands.filter(({ bounds: [[w, s], [e, n]] }) => {
    // Pulau yang melintasi garis 180° dianggap selalu terlihat.
    if (w > e) return true;
    return w <= east + mx && e >= west - mx && s <= north + my && n >= south - my;
  });
}

// Area peta lebih kecil dari ini (derajat) memakai garis pantai resolusi tinggi.
const DETAIL_SPAN = 3;

// Area tampilan: kotak yang memuat semua titik ditambah margin. Pertempuran
// tingkat kota tampil dekat; wilayah luas tampil utuh.
function viewBox(points: SceneMap["points"]): Feature<MultiPoint> & { span: number } {
  const lngs = points.map((p) => p.lng);
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
    geometry: {
      type: "MultiPoint",
      coordinates: [
        [west, south],
        [east, north],
      ],
    },
  };
}

// Garis pantai resolusi tinggi (Natural Earth 10m, sekitar 3 MB) dimuat hanya
// untuk peta yang diperbesar; peta wilayah luas memakai 50m.
let land10Promise: Promise<Island[]> | undefined;
function useIslands(detailed: boolean) {
  const [islands, setIslands] = useState<Island[] | null>(detailed ? null : land50Islands);
  useEffect(() => {
    if (!detailed) return;
    const handle = delayRender("Memuat garis pantai resolusi tinggi");
    land10Promise ??= import("world-atlas/land-10m.json").then((m) => toIslands(m.default));
    land10Promise
      .then(setIslands)
      .catch(() => setIslands(land50Islands))
      .finally(() => continueRender(handle));
  }, [detailed]);
  return islands;
}

const LABEL_FONT = 38;

// Posisi label tiap titik: di atas, bawah, kanan, atau kiri, dipilih yang
// tidak bertumpuk dengan label atau penanda lain.
function placeLabels(projected: [number, number][], labels: string[]) {
  type Box = { x0: number; y0: number; x1: number; y1: number };
  const placed: Box[] = projected.map(([x, y]) => ({ x0: x - 16, y0: y - 16, x1: x + 16, y1: y + 16 }));
  const overlaps = (b: Box) => placed.some((p) => b.x0 < p.x1 && b.x1 > p.x0 && b.y0 < p.y1 && b.y1 > p.y0);
  return projected.map(([x, y], i) => {
    const w = labels[i].length * LABEL_FONT * 0.58;
    const h = LABEL_FONT;
    const options = [
      { x, y: y - 26, anchor: "middle" as const, box: { x0: x - w / 2, y0: y - 26 - h, x1: x + w / 2, y1: y - 26 } },
      { x, y: y + 56, anchor: "middle" as const, box: { x0: x - w / 2, y0: y + 56 - h, x1: x + w / 2, y1: y + 56 } },
      { x: x + 26, y: y + 13, anchor: "start" as const, box: { x0: x + 26, y0: y - 20, x1: x + 26 + w, y1: y + 18 } },
      { x: x - 26, y: y + 13, anchor: "end" as const, box: { x0: x - 26 - w, y0: y - 20, x1: x - 26, y1: y + 18 } },
    ];
    const choice = options.find((o) => !overlaps(o.box)) ?? options[0];
    placed.push(choice.box);
    return choice;
  });
}

type Point = [number, number];

// Titik pada kurva kuadratik dan arah garis singgungnya, untuk panah melengkung.
function quadratic(a: Point, c: Point, b: Point, t: number) {
  const x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0];
  const y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1];
  const dx = 2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
  const dy = 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
  return { x, y, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
}

// Panah gerak pasukan: melengkung, tergambar perlahan dengan kepala panah di ujungnya.
function Arrow({ from, to, color, progress }: { from: Point; to: Point; color: string; progress: number }) {
  if (progress <= 0) return null;
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const control: Point = [
    (from[0] + to[0]) / 2 - ((to[1] - from[1]) / length) * length * 0.18,
    (from[1] + to[1]) / 2 + ((to[0] - from[0]) / length) * length * 0.18,
  ];
  // Kurva berhenti sedikit sebelum titik tujuan agar kepala panah tidak menutupi penanda.
  const end = Math.min(progress, 1) * 0.92;
  const steps = 24;
  const pts = Array.from({ length: steps + 1 }, (_, i) => quadratic(from, control, to, (end * i) / steps));
  const head = pts[pts.length - 1];
  return (
    <g>
      <polyline
        points={pts.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        opacity={0.9}
      />
      <polygon
        points="0,-22 36,0 0,22"
        fill={color}
        transform={`translate(${head.x} ${head.y}) rotate(${head.angle})`}
      />
    </g>
  );
}

// F-29: peta animasi. Daratan dari Natural Earth (world-atlas); zona kekuasaan
// muncul lebih dulu, lalu titik bergantian, rute, dan panah gerak pasukan.
// Warna mengikuti pihak (sides): merah, biru, emas.
export function MapLayer({ map }: { map: SceneMap }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const box = useMemo(() => viewBox(map.points), [map.points]);
  const islands = useIslands(box.span < DETAIL_SPAN);

  const { landPath, projected, zoneRadius, labels } = useMemo(() => {
    const projection = geoMercator().fitExtent(
      [
        [140, 160],
        [WIDTH - 140, HEIGHT - 200],
      ],
      box,
    );
    // Wilayah geografis yang benar-benar terlihat di layar 1920×1080.
    const topLeft = projection.invert?.([0, 0]) ?? [0, 0];
    const bottomRight = projection.invert?.([WIDTH, HEIGHT]) ?? [0, 0];
    const view: [[number, number], [number, number]] = [
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
    const landPath = islands
      ? (geoPath(projection)({
          type: "FeatureCollection",
          features: visibleIslands(islands, view).map((i) => i.feature),
        }) ?? "")
      : "";
    const labels = placeLabels(
      projected,
      map.points.map((p) => p.label),
    );
    return { landPath, projected, zoneRadius, labels };
  }, [box, islands, map.points, map.zones]);

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.07]);
  const stagger = Math.max(6, Math.min(18, Math.floor((durationInFrames * 0.4) / Math.max(1, map.points.length))));
  const appear = (i: number) => spring({ frame: frame - 10 - i * stagger, fps, config: { damping: 14 } });
  const pointsDone = 10 + stagger * map.points.length;

  const routeLength = projected.reduce(
    (sum, [x, y], i) => (i === 0 ? 0 : sum + Math.hypot(x - projected[i - 1][0], y - projected[i - 1][1])),
    0,
  );
  const routeProgress = interpolate(frame, [10, 10 + stagger * Math.max(1, projected.length - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const arrows = (map.arrows ?? []).filter((a) => projected[a.from] && projected[a.to] && a.from !== a.to);
  const arrowProgress = (i: number) => {
    const start = Math.min(pointsDone, durationInFrames * 0.35) + i * 14;
    return interpolate(frame, [start, start + 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  };
  const captionIn = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const sides = map.sides ?? [];

  return (
    <AbsoluteFill style={{ backgroundColor: theme.sea }}>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        <defs>
          <radialGradient id="map-vignette" cx="50%" cy="50%" r="75%">
            <stop offset="60%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.55" />
          </radialGradient>
        </defs>
        <g style={{ transform: `scale(${zoom})`, transformOrigin: "50% 50%" }}>
          <path d={landPath} fill={theme.land} stroke={theme.landEdge} strokeWidth={1.5} />
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
                  fontWeight={800}
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
