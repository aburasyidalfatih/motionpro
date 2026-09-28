import { AbsoluteFill, Img, interpolate, Loop, OffthreadVideo, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";
import type { SceneAssetProps } from "./types";

// Efek ken-burns: zoom perlahan dan geser sedikit; arahnya bergantian per adegan
// agar gerakan tidak monoton.
function useKenBurns(variant: number) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  const zoomIn = variant % 2 === 0;
  const scale = zoomIn ? 1.04 + t * 0.12 : 1.16 - t * 0.12;
  const dx = [-1, 1, 0, 1, -1][variant % 5] * 2.5 * (t - 0.5);
  const dy = [0, -1, 1, 1, -1][variant % 5] * 1.5 * (t - 0.5);
  return `scale(${scale}) translate(${dx}%, ${dy}%)`;
}

export function ImageLayer({ asset, variant }: { asset: SceneAssetProps; variant: number }) {
  const transform = useKenBurns(variant);
  const aspect = asset.width && asset.height ? asset.width / asset.height : 16 / 9;

  // Lukisan potret atau persegi: latar buram dari gambar yang sama, lalu
  // gambar utuh di tengah, agar tidak terpotong berlebihan.
  if (aspect < 1.3) {
    return (
      <AbsoluteFill style={{ backgroundColor: theme.night }}>
        <Img
          src={asset.src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: "blur(40px) brightness(0.45)",
            transform: "scale(1.2)",
          }}
        />
        <AbsoluteFill style={{ transform }}>
          <Img src={asset.src} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ backgroundColor: theme.night, overflow: "hidden" }}>
      <AbsoluteFill style={{ transform }}>
        <Img src={asset.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function FootageLayer({ asset }: { asset: SceneAssetProps }) {
  const { fps } = useVideoConfig();
  const video = <OffthreadVideo src={asset.src} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
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
