import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useBeats } from "../beats";
import { theme } from "../theme";

const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Teks kinetik: tiap baris muncul saat narator mengucapkannya, kata demi kata;
// kata penting disorot emas dengan garis bawah yang tumbuh.
export function KineticText({ lines, emphasis }: { lines: string[]; emphasis: string[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const emphasized = new Set(emphasis.flatMap((e) => e.split(/\s+/)).map(normalize));
  const beats = useBeats(lines.map((line) => [line]));
  const perWord = 3;

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 160px" }}>
      {lines.map((line, li) => (
        <div
          key={li}
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "0 28px",
            fontFamily: theme.sans,
            fontSize: lines.length > 2 ? 84 : 104,
            fontWeight: 800,
            lineHeight: 1.18,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          {line.split(/\s+/).map((word, wi) => {
            const delay = beats[li] + wi * perWord;
            const enter = spring({ frame: frame - delay, fps, config: { damping: 16, mass: 0.6 } });
            const strong = emphasized.has(normalize(word));
            const underline = spring({ frame: frame - delay - 8, fps, config: { damping: 200 } });
            return (
              <span
                key={wi}
                style={{
                  position: "relative",
                  display: "inline-block",
                  color: strong ? theme.goldStrong : theme.ink,
                  opacity: Math.min(1, enter),
                  transform: `translateY(${interpolate(enter, [0, 1], [50, 0])}px) scale(${interpolate(enter, [0, 1], [0.9, 1])})`,
                  textShadow: theme.shadow,
                }}
              >
                {word}
                {strong && (
                  <span
                    style={{
                      position: "absolute",
                      left: 0,
                      bottom: 4,
                      height: 8,
                      width: `${underline * 100}%`,
                      background: theme.goldStrong,
                      opacity: 0.8,
                    }}
                  />
                )}
              </span>
            );
          })}
        </div>
      ))}
    </AbsoluteFill>
  );
}
