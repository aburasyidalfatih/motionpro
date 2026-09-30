import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop } from "./graphics/Backdrop";
import { theme } from "./theme";

// End screen YouTube (20 detik): latar bergerak, ajakan menonton, dan bingkai
// tempat elemen akhir YouTube (dua video dan tombol subscribe) diletakkan di
// YouTube Studio: Editor → End screen → template "1 video, 1 playlist, 1 subscribe".
// Bingkainya samar agar tetap rapi bila elemen YouTube tidak dipasang.
export function EndScreen({ title }: { title: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = (delay: number) => spring({ frame: frame - delay, fps, config: { damping: 200 } });
  const fadeIn = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const box = (left: number, delay: number) => (
    <div
      style={{
        position: "absolute",
        left,
        top: 380,
        width: 700,
        height: 394,
        borderRadius: 14,
        border: `3px solid rgba(224,181,101,${0.35 * enter(delay)})`,
        background: "rgba(10,16,22,0.45)",
        transform: `translateY(${interpolate(enter(delay), [0, 1], [40, 0])}px)`,
        opacity: enter(delay),
      }}
    />
  );
  return (
    <AbsoluteFill style={{ opacity: fadeIn }}>
      <Backdrop />
      <div
        style={{
          position: "absolute",
          top: 120,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: theme.sans,
          color: theme.ink,
          opacity: enter(6),
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 10, color: theme.goldStrong, fontWeight: 700 }}>
          TERIMA KASIH SUDAH MENONTON
        </div>
        <div style={{ fontFamily: theme.serif, fontSize: 76, fontWeight: 700, marginTop: 14 }}>
          Kisah berikutnya menunggu
        </div>
        <div style={{ fontSize: 30, color: theme.muted, marginTop: 10 }}>{title}</div>
      </div>
      {box(170, 14)}
      {box(1050, 20)}
      <div
        style={{
          position: "absolute",
          left: 960 - 95,
          top: 820,
          width: 190,
          height: 190,
          borderRadius: "50%",
          border: `3px solid rgba(224,181,101,${0.5 * enter(26)})`,
          boxShadow: `0 0 ${20 + 10 * Math.sin(frame / 10)}px rgba(224,181,101,0.35)`,
          opacity: enter(26),
        }}
      />
    </AbsoluteFill>
  );
}
