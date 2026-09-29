import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useBeats } from "../beats";
import { sideColors, theme } from "../theme";
import type { Comparison } from "../types";

const HALF = 560;

// Perbandingan dua pihak: kolom kiri merah, kanan biru. Baris dengan angka di
// kedua sisi digambar sebagai batang yang tumbuh dari tengah. Tiap baris
// muncul saat narator membahas aspek itu.
export function ComparisonScene({ comparison }: { comparison: Comparison }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = useBeats(comparison.rows.map((r) => [r.cue, r.label, r.left, r.right]));
  const header = spring({ frame: frame - 4, fps, config: { damping: 200 } });
  const [leftColor, rightColor] = sideColors;

  return (
    <AbsoluteFill style={{ fontFamily: theme.sans, color: theme.ink, alignItems: "center", paddingTop: 180 }}>
      <div style={{ display: "flex", width: HALF * 2 + 240, justifyContent: "space-between", opacity: header }}>
        {[comparison.left, comparison.right].map((name, i) => (
          <div
            key={i}
            style={{
              width: HALF,
              textAlign: i === 0 ? "right" : "left",
              fontSize: 64,
              fontWeight: 800,
              textTransform: "uppercase",
              color: i === 0 ? leftColor : rightColor,
              transform: `translateX(${interpolate(header, [0, 1], [i === 0 ? -60 : 60, 0])}px)`,
            }}
          >
            {name}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 50, display: "flex", flexDirection: "column", gap: 34 }}>
        {comparison.rows.map((row, i) => {
          const enter = spring({ frame: frame - beats[i], fps, config: { damping: 200 } });
          const numeric = row.leftValue !== undefined && row.rightValue !== undefined;
          const max = numeric ? Math.max(row.leftValue!, row.rightValue!, 1) : 1;
          const bar = (value: number | undefined) => (numeric ? ((value ?? 0) / max) * (HALF - 40) * enter : 0);
          return (
            <div key={i} style={{ opacity: enter, transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)` }}>
              <div
                style={{
                  textAlign: "center",
                  fontSize: 30,
                  color: theme.muted,
                  letterSpacing: 3,
                  textTransform: "uppercase",
                }}
              >
                {row.label}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 10 }}>
                <div
                  style={{ width: HALF, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 20 }}
                >
                  <span style={{ fontSize: 44, fontWeight: 700 }}>{row.left}</span>
                  {numeric && (
                    <div style={{ height: 36, width: bar(row.leftValue), background: leftColor, borderRadius: 4 }} />
                  )}
                </div>
                <div style={{ width: 4, height: 50, background: theme.muted, opacity: 0.5 }} />
                <div style={{ width: HALF, display: "flex", alignItems: "center", gap: 20 }}>
                  {numeric && (
                    <div style={{ height: 36, width: bar(row.rightValue), background: rightColor, borderRadius: 4 }} />
                  )}
                  <span style={{ fontSize: 44, fontWeight: 700 }}>{row.right}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
