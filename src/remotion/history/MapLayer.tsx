import { geoMercator, geoPath } from "d3-geo";
import type { Feature, MultiPoint } from "geojson";
import { useMemo } from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import land from "world-atlas/land-50m.json";
import { theme } from "./theme";
import type { SceneMap } from "./types";

const WIDTH = 1920;
const HEIGHT = 1080;
const topology = land as unknown as Topology<{ land: GeometryCollection }>;
const landShape = feature(topology, topology.objects.land);

// Area tampilan: kotak yang memuat semua titik, diperluas agar konteks
// geografisnya terlihat (minimal sekitar 8 derajat).
function viewBox(points: SceneMap["points"]): Feature<MultiPoint> {
  const lngs = points.map((p) => p.lng);
  const lats = points.map((p) => p.lat);
  const pad = (min: number, max: number, minSpan: number) => {
    const span = Math.max(max - min, minSpan);
    const mid = (min + max) / 2;
    return [mid - span * 0.75, mid + span * 0.75];
  };
  const [west, east] = pad(Math.min(...lngs), Math.max(...lngs), 8);
  const [south, north] = pad(Math.min(...lats), Math.max(...lats), 5);
  return {
    type: "Feature",
    properties: {},
    geometry: {
      type: "MultiPoint",
      coordinates: [
        [west, south],
        [east, north],
      ],
    },
  };
}

// F-29: peta animasi. Daratan dari Natural Earth (world-atlas), titik muncul
// bergantian, dan rute (bila ada) digambar perlahan.
export function MapLayer({ map }: { map: SceneMap }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const { landPath, projected } = useMemo(() => {
    const projection = geoMercator()
      .fitExtent(
        [
          [140, 160],
          [WIDTH - 140, HEIGHT - 200],
        ],
        viewBox(map.points),
      )
      .clipExtent([
        [-50, -50],
        [WIDTH + 50, HEIGHT + 50],
      ]);
    return {
      landPath: geoPath(projection)(landShape) ?? "",
      projected: map.points.map((p) => projection([p.lng, p.lat]) ?? [WIDTH / 2, HEIGHT / 2]),
    };
  }, [map.points]);

  const zoom = interpolate(frame, [0, durationInFrames], [1, 1.07]);
  const stagger = Math.max(6, Math.min(18, Math.floor((durationInFrames * 0.5) / Math.max(1, map.points.length))));
  const appear = (i: number) => spring({ frame: frame - 10 - i * stagger, fps, config: { damping: 14 } });

  const routeLength = projected.reduce(
    (sum, [x, y], i) => (i === 0 ? 0 : sum + Math.hypot(x - projected[i - 1][0], y - projected[i - 1][1])),
    0,
  );
  const routeProgress = interpolate(frame, [10, 10 + stagger * Math.max(1, projected.length - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const captionIn = spring({ frame: frame - 4, fps, config: { damping: 200 } });

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
          {projected.map(([x, y], i) => {
            const s = appear(i);
            return (
              <g key={map.points[i].label + i} opacity={Math.min(1, s)}>
                <circle cx={x} cy={y} r={14 * s} fill={theme.marker} stroke="#fff" strokeWidth={3} />
                <text
                  x={x}
                  y={y - 26}
                  textAnchor="middle"
                  fontFamily={theme.serif}
                  fontSize={40}
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
            fontFamily: theme.serif,
            fontSize: 44,
            opacity: captionIn,
            transform: `translateX(${interpolate(captionIn, [0, 1], [-30, 0])}px)`,
          }}
        >
          {map.caption}
        </div>
      )}
    </AbsoluteFill>
  );
}
