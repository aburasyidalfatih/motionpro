import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { chartCues, useBeats } from "../beats";
import { theme } from "../theme";
import type { Chart } from "../types";

const LEFT = 200;
const RIGHT = 1720;
// Garis dasar cukup tinggi agar label batang tidak tertutup subtitle.
const BASE_Y = 770;
const MAX_HEIGHT = 450;

const format = (value: number) =>
  value.toLocaleString("id-ID", { maximumFractionDigits: Number.isInteger(value) ? 0 : 1 });

// Grafik batang: tiap batang tumbuh saat narator menyebutnya, angkanya
// menghitung naik, dan batang tertinggi disorot emas.
export function ChartScene({ chart }: { chart: Chart }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bars = chart.bars;
  const beats = useBeats(chartCues(chart));
  const max = Math.max(...bars.map((b) => b.value), 1);
  const slot = (RIGHT - LEFT) / bars.length;
  const width = Math.min(170, slot * 0.62);
  const axis = spring({ frame: frame - 2, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
        <line
          x1={LEFT - 40}
          x2={LEFT - 40 + (RIGHT - LEFT + 80) * axis}
          y1={BASE_Y}
          y2={BASE_Y}
          stroke={theme.muted}
          strokeWidth={4}
        />
      </svg>
      {bars.map((bar, i) => {
        const grow = spring({ frame: frame - beats[i], fps, config: { damping: 20, mass: 0.8 } });
        const count = interpolate(frame, [beats[i], beats[i] + 30], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const top = bar.value === max;
        const height = Math.max(4, (bar.value / max) * MAX_HEIGHT) * Math.min(1, grow);
        const x = LEFT + slot * i + (slot - width) / 2;
        return (
          <div key={i} style={{ fontFamily: theme.sans, opacity: Math.min(1, grow * 1.5) }}>
            <div
              style={{
                position: "absolute",
                left: x,
                top: BASE_Y - height,
                width,
                height,
                borderRadius: "6px 6px 0 0",
                background: top
                  ? `linear-gradient(to top, #a8792f, ${theme.goldStrong})`
                  : "linear-gradient(to top, #3a5468, #6f8ea6)",
                boxShadow: top ? `0 0 30px rgba(224,181,101,0.45)` : undefined,
              }}
            />
            <div
              style={{
                position: "absolute",
                left: x - 60,
                width: width + 120,
                top: BASE_Y - height - 76,
                textAlign: "center",
                fontSize: bars.length > 5 ? 44 : 56,
                fontWeight: 800,
                color: top ? theme.goldStrong : theme.ink,
                textShadow: theme.shadow,
                whiteSpace: "nowrap",
              }}
            >
              {chart.prefix && <span style={{ fontSize: "0.55em" }}>{chart.prefix}</span>}
              {format(bar.value * (1 - Math.pow(1 - count, 3)))}
              {chart.suffix && <span style={{ fontSize: "0.5em" }}>{chart.suffix}</span>}
            </div>
            <div
              style={{
                position: "absolute",
                left: x - 50,
                width: width + 100,
                top: BASE_Y + 22,
                textAlign: "center",
                fontSize: bars.length > 5 ? 28 : 34,
                fontWeight: 600,
                lineHeight: 1.2,
                color: theme.inkSoft,
              }}
            >
              {bar.label}
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
