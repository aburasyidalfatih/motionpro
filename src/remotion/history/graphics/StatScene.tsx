import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import type { Stat } from "../types";

// Tahun (misalnya 1945) ditulis tanpa pemisah ribuan.
const looksLikeYear = (stat: Stat) =>
  Number.isInteger(stat.value) && stat.value >= 1000 && stat.value <= 2100 && !stat.prefix && !stat.suffix;

const format = (value: number, decimals: number, grouping: boolean) =>
  value.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: grouping,
  });

// Statistik: 1–3 angka besar yang menghitung naik, dengan keterangan di bawahnya.
export function StatScene({ stats }: { stats: Stat[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 120, padding: "0 120px" }}
    >
      {stats.map((stat, i) => {
        const delay = 8 + i * 14;
        const enter = spring({ frame: frame - delay, fps, config: { damping: 200 } });
        const count = interpolate(frame, [delay, delay + 45], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const eased = 1 - Math.pow(1 - count, 3);
        const decimals = Number.isInteger(stat.value) ? 0 : 1;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              maxWidth: 560,
              textAlign: "center",
              fontFamily: theme.sans,
              opacity: enter,
              transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
            }}
          >
            <div
              style={{
                fontSize: stats.length > 2 ? 110 : 150,
                fontWeight: 800,
                color: theme.goldStrong,
                lineHeight: 1,
                textShadow: theme.shadow,
              }}
            >
              {stat.prefix && <span style={{ fontSize: "0.5em" }}>{stat.prefix}</span>}
              {format(stat.value * eased, decimals, !looksLikeYear(stat))}
              {stat.suffix && <span style={{ fontSize: "0.45em", whiteSpace: "nowrap" }}>{stat.suffix}</span>}
            </div>
            <div
              style={{ height: 6, width: `${enter * 60}%`, margin: "28px auto", background: theme.muted, opacity: 0.5 }}
            />
            <div style={{ fontSize: 40, fontWeight: 600, color: theme.ink, lineHeight: 1.25 }}>{stat.label}</div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
