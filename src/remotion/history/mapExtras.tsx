import { geoGraticule, geoOrthographic, geoPath } from "d3-geo";
import type { Feature, FeatureCollection } from "geojson";
import ms from "milsymbol";
import { AbsoluteFill, Easing, interpolate } from "remotion";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land110 from "world-atlas/land-110m.json";
import { sideColor, theme } from "./theme";
import type { UnitKind } from "./types";

type Point = [number, number];

// Kode simbol militer (MIL-STD-2525C) per jenis satuan; huruf kedua (afiliasi)
// diisi sesuai pihak. Warna standar kebetulan cocok dengan warna pihak di peta:
// pihak 0 merah (hostile), 1 biru (friend), 2 kuning (unknown), tanpa pihak hijau.
const UNIT_CODES: Record<UnitKind, string> = {
  infantry: "S?GPUCI----",
  cavalry: "S?GPUCR----",
  armor: "S?GPUCA----",
  artillery: "S?GPUCF----",
  naval: "S?SPCL-----",
  air: "S?APMF-----",
  hq: "S?GPUH-----",
};
const AFFILIATION = ["H", "F", "U"];

const symbolCache = new Map<string, { url: string; width: number; height: number }>();

// Simbol satuan sebagai gambar SVG (data URL), dibuat sekali per jenis dan pihak.
export function unitSymbol(unit: UnitKind, side: number | undefined, size = 44) {
  const affiliation = side === undefined ? "N" : (AFFILIATION[side] ?? "U");
  const sidc = UNIT_CODES[unit].replace("?", affiliation);
  const key = `${sidc}-${size}`;
  let cached = symbolCache.get(key);
  if (!cached) {
    const symbol = new ms.Symbol(sidc, { size, outlineWidth: 3, outlineColor: "#1b140c" });
    const { width, height } = symbol.getSize();
    cached = { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(symbol.asSVG())}`, width, height };
    symbolCache.set(key, cached);
  }
  return cached;
}

export function UnitIcon({ unit, side, at, scale }: { unit: UnitKind; side?: number; at: Point; scale: number }) {
  const symbol = unitSymbol(unit, side);
  const width = symbol.width * scale;
  const height = symbol.height * scale;
  return (
    <image
      href={symbol.url}
      x={at[0] - width / 2}
      y={at[1] - height / 2}
      width={width}
      height={height}
      style={{ filter: "drop-shadow(3px 5px 4px rgba(0,0,0,0.45))" }}
    />
  );
}

// Lokasi bentrokan: cahaya api yang berdenyut, cincin yang memancar berulang,
// dan dua pedang bersilang.
export function BattleBurst({ at, frame, appear }: { at: Point; frame: number; appear: number }) {
  if (appear <= 0) return null;
  const pulse = 0.5 + 0.5 * Math.sin(frame / 4);
  const ring = (frame % 36) / 36;
  const [x, y] = at;
  const sword = (angle: number) => (
    <g transform={`rotate(${angle} ${x} ${y})`}>
      <line x1={x} y1={y - 30} x2={x} y2={y + 22} stroke="#f3e6cf" strokeWidth={5} strokeLinecap="round" />
      <line x1={x - 10} y1={y + 12} x2={x + 10} y2={y + 12} stroke="#f3e6cf" strokeWidth={5} strokeLinecap="round" />
    </g>
  );
  return (
    <g opacity={Math.min(1, appear)}>
      <defs>
        <radialGradient id={`fire-${x}-${y}`}>
          <stop offset="0%" stopColor="#ffd27a" stopOpacity={0.95} />
          <stop offset="45%" stopColor="#e2582c" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#e2582c" stopOpacity={0} />
        </radialGradient>
      </defs>
      <circle cx={x} cy={y} r={(46 + pulse * 18) * appear} fill={`url(#fire-${x}-${y})`} />
      <circle cx={x} cy={y} r={30 + ring * 70} fill="none" stroke="#e2582c" strokeWidth={4} opacity={1 - ring} />
      <g transform={`translate(${x} ${y}) scale(${appear}) translate(${-x} ${-y})`}>
        {sword(40)}
        {sword(-40)}
      </g>
    </g>
  );
}

// Garis depan: garis tebal bergerigi di antara dua pihak, tergambar sampai `progress`.
export function FrontLine({ points, progress }: { points: Point[]; progress: number }) {
  if (points.length < 2 || progress <= 0) return null;
  const d = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const length = points.reduce(
    (sum, p, i) => (i === 0 ? 0 : sum + Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1])),
    0,
  );
  const dash = { strokeDasharray: length, strokeDashoffset: length * (1 - Math.min(1, progress)) };
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} stroke="#1b140c" strokeWidth={14} opacity={0.5} style={dash} />
      <path d={d} stroke={sideColor(0)} strokeWidth={8} style={dash} />
      <path d={d} stroke="#f3e6cf" strokeWidth={3} strokeDasharray="4 14" opacity={Math.min(1, progress * 2)} />
    </g>
  );
}

const globeLand = (() => {
  const t = land110 as unknown as Topology<{ land: GeometryCollection }>;
  return feature(t, t.objects.land) as FeatureCollection | Feature;
})();

// Durasi globe pembuka (frame) sebelum peta detail tampil.
export const GLOBE_INTRO_FRAMES = 50;

// Globe pembuka: bumi berputar ke lokasi adegan lalu kamera menukik masuk,
// sebelum peta detail tampil. Dipakai pada peta pertama dan saat lokasi
// berpindah jauh dari peta sebelumnya.
export function GlobeIntro({ center, frame }: { center: [number, number]; frame: number }) {
  const t = interpolate(frame, [0, GLOBE_INTRO_FRAMES], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  if (t >= 1) return null;
  const spin = Easing.out(Easing.cubic)(Math.min(1, t / 0.7));
  const dive = Easing.in(Easing.cubic)(Math.max(0, (t - 0.45) / 0.55));
  const projection = geoOrthographic()
    .rotate([-(center[0] - 70 * (1 - spin)), -(center[1] * spin), 0])
    .scale(400 * (1 + dive * 9))
    .translate([960, 540])
    .clipAngle(90);
  const path = geoPath(projection);
  const target = projection(center) ?? [960, 540];
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at 50% 45%, #1a2a36 0%, ${theme.night} 70%)`,
        opacity: interpolate(t, [0.8, 1], [1, 0], { extrapolateLeft: "clamp" }),
      }}
    >
      <svg width="1920" height="1080" viewBox="0 0 1920 1080">
        <defs>
          <radialGradient id="globe-shade" cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity={0.12} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.45} />
          </radialGradient>
        </defs>
        <path
          d={path({ type: "Sphere" }) ?? ""}
          fill={theme.sea}
          stroke={theme.muted}
          strokeOpacity={0.4}
          strokeWidth={2}
        />
        <path d={path(geoGraticule().step([15, 15])()) ?? ""} fill="none" stroke="#fff" strokeOpacity={0.08} />
        <path d={path(globeLand) ?? ""} fill={theme.land} stroke={theme.landEdge} strokeWidth={1} />
        <path d={path({ type: "Sphere" }) ?? ""} fill="url(#globe-shade)" />
        <circle
          cx={target[0]}
          cy={target[1]}
          r={10 + (frame % 20)}
          fill="none"
          stroke={theme.goldStrong}
          strokeWidth={4}
          opacity={spin * (1 - (frame % 20) / 20)}
        />
        <circle cx={target[0]} cy={target[1]} r={8} fill={theme.goldStrong} opacity={spin} />
      </svg>
    </AbsoluteFill>
  );
}
