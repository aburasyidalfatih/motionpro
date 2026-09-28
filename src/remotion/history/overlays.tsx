import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { subtitleLines } from "./timing";
import { theme } from "./theme";
import type { WordTiming } from "./types";

function useEnter(delayFrames: number) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delayFrames, fps, config: { damping: 200 } });
}

// Kartu judul besar untuk adegan bertipe "title".
export function TitleOverlay({ title }: { title: string }) {
  const titleIn = useEnter(6);
  const ruleIn = useEnter(14);
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center",
        padding: 140,
        background: "rgba(0,0,0,0.35)",
        fontFamily: theme.serif,
        color: theme.ink,
      }}
    >
      <h1
        style={{
          fontSize: 116,
          lineHeight: 1.05,
          margin: 0,
          fontWeight: 700,
          textShadow: theme.shadow,
          opacity: titleIn,
          transform: `translateY(${interpolate(titleIn, [0, 1], [40, 0])}px)`,
        }}
      >
        {title}
      </h1>
      <div style={{ height: 3, marginTop: 36, width: 520 * ruleIn, backgroundColor: theme.goldStrong }} />
    </AbsoluteFill>
  );
}

// Teks singkat di layar (onScreenText) sebagai label di kiri atas.
export function LabelOverlay({ text }: { text: string }) {
  const enter = useEnter(8);
  return (
    <div
      style={{
        position: "absolute",
        top: 64,
        left: 72,
        maxWidth: 1100,
        padding: "14px 28px",
        background: theme.panel,
        borderLeft: `4px solid ${theme.goldStrong}`,
        color: theme.ink,
        fontFamily: theme.serif,
        fontSize: 46,
        lineHeight: 1.2,
        opacity: enter,
        transform: `translateX(${interpolate(enter, [0, 1], [-30, 0])}px)`,
      }}
    >
      {text}
    </div>
  );
}

// Penanda tahun di kanan atas untuk adegan dengan tanggal penting.
export function TimelineBadge({ date, label }: { date: string; label: string }) {
  const enter = useEnter(12);
  return (
    <div
      style={{
        position: "absolute",
        top: 56,
        right: 72,
        textAlign: "right",
        fontFamily: theme.serif,
        color: theme.ink,
        textShadow: theme.shadow,
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [-20, 0])}px)`,
      }}
    >
      <div style={{ fontSize: 96, fontWeight: 700, color: theme.goldStrong, lineHeight: 1 }}>{date}</div>
      <div style={{ fontSize: 34, marginTop: 8, maxWidth: 640 }}>{label}</div>
    </div>
  );
}

// Subtitle karaoke: satu baris pendek, kata yang sedang diucapkan disorot.
// Waktu kata relatif terhadap awal narasi adegan.
export function Subtitles({ words }: { words: WordTiming[] }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ms = (frame / fps) * 1000;
  const lines = subtitleLines(words);
  const line = lines.find((l, i) => ms >= l.startMs - 150 && ms < (lines[i + 1]?.startMs ?? l.endMs + 600) - 150);
  if (!line) return null;

  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", paddingBottom: 90 }}>
      <div
        style={{
          maxWidth: 1500,
          padding: "12px 28px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.55)",
          fontFamily: "'Helvetica Neue', Arial, 'Liberation Sans', sans-serif",
          fontSize: 48,
          fontWeight: 700,
          lineHeight: 1.25,
          textAlign: "center",
        }}
      >
        {line.words.map((w, i) => {
          // Hanya satu kata yang disorot: kata terakhir yang sudah mulai diucapkan.
          const next = line.words[i + 1];
          const active = ms >= w.startMs && ms < (next ? next.startMs : w.endMs + 300);
          const spoken = ms >= w.endMs;
          return (
            <span key={i} style={{ color: active ? theme.goldStrong : spoken ? "#ffffff" : "rgba(255,255,255,0.75)" }}>
              {w.word}
              {i < line.words.length - 1 ? " " : ""}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}
