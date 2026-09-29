import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { useSceneSpeech } from "../beats";
import { theme } from "../theme";

// Kutipan: tanda kutip besar, teks muncul kata demi kata, lalu sumbernya.
export function QuoteScene({ text, source }: { text: string; source: string }) {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const words = text.split(/\s+/);
  // Kutipan terbuka mengikuti narasi; tanpa voice over dalam 60% durasi adegan.
  const speech = useSceneSpeech();
  const spoken = speech.words.length > 0;
  const toFrame = (ms: number) => speech.offset + (ms / 1000) * fps;
  const revealStart = spoken ? toFrame(speech.words[0].startMs) : 8;
  const revealEnd = Math.max(
    revealStart + 20,
    spoken ? toFrame(speech.words.at(-1)!.endMs) * 0.9 : durationInFrames * 0.6,
  );
  const shown = interpolate(frame, [revealStart, revealEnd], [0, words.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const mark = spring({ frame, fps, config: { damping: 200 } });
  const sourceIn = spring({ frame: frame - revealEnd, fps, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 220px" }}>
      <div style={{ position: "relative", fontFamily: theme.serif, color: theme.ink, textAlign: "center" }}>
        <div
          style={{
            position: "absolute",
            top: -170,
            left: "50%",
            transform: `translateX(-50%) scale(${mark})`,
            fontSize: 260,
            lineHeight: 1,
            color: theme.goldStrong,
            opacity: 0.8,
          }}
        >
          “
        </div>
        <div style={{ fontSize: words.length > 30 ? 52 : 64, lineHeight: 1.35, fontStyle: "italic" }}>
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                opacity: interpolate(shown - i, [0, 1], [0.08, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              {word}{" "}
            </span>
          ))}
        </div>
        <div
          style={{
            marginTop: 44,
            fontFamily: theme.sans,
            fontSize: 34,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: theme.gold,
            opacity: sourceIn,
          }}
        >
          — {source}
        </div>
      </div>
    </AbsoluteFill>
  );
}
