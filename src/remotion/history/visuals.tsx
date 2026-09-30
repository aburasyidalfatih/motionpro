import { AbsoluteFill, Loop, OffthreadVideo, random, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import type { SceneAssetProps } from "./types";

// Footage stok diberi warna sesuai era agar menyatu dengan foto arsip dan lukisan.
export function FootageLayer({ asset, filter }: { asset: SceneAssetProps; filter?: string }) {
  const { fps } = useVideoConfig();
  const video = (
    <OffthreadVideo src={asset.src} muted style={{ width: "100%", height: "100%", objectFit: "cover", filter }} />
  );
  // Footage yang lebih pendek dari adegan diulang.
  const loopFrames = asset.durationMs ? Math.floor((asset.durationMs / 1000) * fps) - 1 : null;
  return (
    <AbsoluteFill style={{ backgroundColor: theme.night }}>
      {loopFrames && loopFrames > fps ? <Loop durationInFrames={loopFrames}>{video}</Loop> : video}
    </AbsoluteFill>
  );
}

// Adegan tanpa aset: latar perkamen gelap bergradasi.
export function FallbackLayer() {
  return (
    <AbsoluteFill
      style={{ background: "radial-gradient(ellipse at 30% 35%, #6b4a2b 0%, #3a2616 45%, #120d08 100%)" }}
    />
  );
}

// Vignette dan gradasi bawah agar teks dan subtitle tetap terbaca.
export function Vignette() {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%), linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 30%)",
      }}
    />
  );
}

const PARTICLES = 46;

// Partikel yang melayang di atas lukisan dan ilustrasi: bara api naik untuk
// suasana tegang atau epik, debu halus untuk suasana tenang. Posisi dari
// random() Remotion agar sama di semua tab render.
export function CinematicParticles({ mood, seed }: { mood: string | null; seed: string }) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const embers = mood === "tense" || mood === "epic";
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "screen" }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {Array.from({ length: PARTICLES }, (_, i) => {
          const r = (k: string) => random(`${seed}-${i}-${k}`);
          const speed = (embers ? 1.6 : 0.5) + r("s") * (embers ? 2.2 : 0.8);
          const travel = (r("y") * height + frame * speed) % (height + 40);
          const x = r("x") * width + Math.sin(frame / (20 + r("w") * 30) + i) * (embers ? 24 : 40);
          const y = embers ? height + 20 - travel : travel - 20;
          const size = (embers ? 1.5 : 1) + r("r") * (embers ? 3.5 : 2.5);
          const flicker = 0.45 + 0.55 * Math.abs(Math.sin(frame / (6 + r("f") * 10) + i));
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={size}
              fill={embers ? "#ffb35c" : "#f3e6cf"}
              opacity={(embers ? 0.75 : 0.35) * flicker}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
}
