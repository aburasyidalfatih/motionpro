import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { eventCues, useBeats } from "../beats";
import { theme } from "../theme";
import type { TimelineMark } from "../types";

const LEFT = 180;
const RIGHT = 1740;
const AXIS_Y = 560;

// Timeline: peristiwa muncul saat narator menyebut tanggalnya (tanggal di atas,
// keterangan di bawah); garis waktu tumbuh sampai peristiwa itu dan peristiwa
// yang sedang dibahas disorot.
export function TimelineScene({ events }: { events: TimelineMark[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beats = useBeats(eventCues(events));
  const x = (i: number) =>
    events.length === 1 ? (LEFT + RIGHT) / 2 : LEFT + ((RIGHT - LEFT) * i) / (events.length - 1);
  // Ujung garis bergerak dari peristiwa ke peristiwa, lalu sampai tepi kanan.
  const reach = interpolate(
    frame,
    [0, ...beats.map((b) => b + 12), beats.at(-1)! + 40],
    [LEFT - 60, ...events.map((_, i) => x(i)), RIGHT + 60],
    { extrapolateRight: "clamp", easing: (t) => 1 - Math.pow(1 - t, 3) },
  );
  const current = Math.max(0, beats.filter((b) => frame >= b).length - 1);

  return (
    <AbsoluteFill>
      <svg width="1920" height="1080" viewBox="0 0 1920 1080" style={{ position: "absolute" }}>
        <line x1={LEFT - 60} y1={AXIS_Y} x2={reach} y2={AXIS_Y} stroke={theme.muted} strokeWidth={4} />
      </svg>
      {events.map((event, i) => {
        const enter = spring({ frame: frame - beats[i], fps, config: { damping: 18 } });
        const last = i === current;
        const color = last ? theme.goldStrong : theme.ink;
        const up = i % 2 === 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x(i) - 170,
              width: 340,
              top: 0,
              height: 1080,
              opacity: Math.min(1, enter),
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 170 - (last ? 16 : 12),
                top: AXIS_Y - (last ? 16 : 12),
                width: last ? 32 : 24,
                height: last ? 32 : 24,
                borderRadius: "50%",
                background: color,
                boxShadow: last ? `0 0 30px ${theme.goldStrong}` : undefined,
                transform: `scale(${enter})`,
              }}
            />
            <div
              style={{
                position: "absolute",
                width: "100%",
                textAlign: "center",
                top: up ? AXIS_Y - 150 : AXIS_Y + 44,
                transform: `translateY(${interpolate(enter, [0, 1], [up ? 30 : -30, 0])}px)`,
                fontFamily: theme.sans,
                color,
              }}
            >
              <div style={{ fontSize: 56, fontWeight: 800 }}>{event.date}</div>
              <div style={{ fontSize: 28, lineHeight: 1.25, color: last ? theme.ink : theme.inkSoft, marginTop: 6 }}>
                {event.label}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
}
