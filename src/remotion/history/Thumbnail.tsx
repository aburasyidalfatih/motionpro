import { AbsoluteFill, Img } from "remotion";
import { SceneSpeechContext } from "./beats";
import { Backdrop } from "./graphics/Backdrop";
import { MapLayer } from "./MapLayer";
import { theme } from "./theme";
import type { SceneProps } from "./types";

// Thumbnail YouTube: latar dari adegan paling visual (ilustrasi, lukisan, atau
// peta), gradasi gelap di kiri, teks besar 2–4 kata dengan satu kata disorot
// emas, dan label tahun. Dirender sebagai still pada frame akhir adegan latar
// agar isi peta (titik, panah) sudah tampil semua.
export type ThumbnailProps = {
  text: string;
  // Tahun atau label kecil di atas teks, misalnya "1945".
  kicker: string | null;
  scene: SceneProps | null;
  // Durasi adegan latar dalam frame (dipakai sebagai durasi komposisi).
  frames: number;
};

function Background({ scene }: { scene: SceneProps | null }) {
  if (scene?.asset?.kind === "IMAGE") {
    return <Img src={scene.asset.src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />;
  }
  if (scene?.visualType === "map" && scene.graphic.map?.points.length) {
    return (
      <SceneSpeechContext.Provider value={{ words: [], offset: 0 }}>
        <MapLayer map={scene.graphic.map} bare />
      </SceneSpeechContext.Provider>
    );
  }
  return <Backdrop />;
}

export function Thumbnail({ text, kicker, scene }: ThumbnailProps) {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean).slice(0, 5);
  // Dua baris: kata terakhir disorot emas.
  const split = Math.ceil(words.length / 2);
  const lines = [words.slice(0, split), words.slice(split)].filter((l) => l.length);
  const long = words.join(" ").length > 18;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.night }}>
      <AbsoluteFill style={{ transform: "scale(1.08)", filter: "saturate(1.15) contrast(1.1)" }}>
        <Background scene={scene} />
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(90deg, rgba(5,8,12,0.92) 0%, rgba(5,8,12,0.7) 38%, rgba(5,8,12,0) 70%), radial-gradient(ellipse at 70% 50%, transparent 40%, rgba(0,0,0,0.55) 100%)",
        }}
      />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 90px", fontFamily: theme.sans }}>
        {kicker && (
          <div
            style={{
              alignSelf: "flex-start",
              padding: "8px 26px",
              marginBottom: 26,
              background: theme.goldStrong,
              color: "#140d05",
              fontSize: 64,
              fontWeight: 800,
              letterSpacing: 4,
            }}
          >
            {kicker}
          </div>
        )}
        {lines.map((line, li) => (
          <div
            key={li}
            style={{
              fontSize: long ? 150 : 190,
              fontWeight: 800,
              lineHeight: 0.98,
              maxWidth: 1250,
              color: li === lines.length - 1 ? theme.goldStrong : "#ffffff",
              WebkitTextStroke: "4px #0b0b0b",
              paintOrder: "stroke fill",
              textShadow: "0 10px 30px rgba(0,0,0,0.85)",
            }}
          >
            {line.join(" ")}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
