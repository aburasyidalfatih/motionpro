import { msToFrames } from "@/remotion/history/timing";
import type { ThumbnailProps } from "@/remotion/history/Thumbnail";
import type { HistoryVideoProps, SceneProps } from "@/remotion/history/types";

// Adegan paling visual untuk latar thumbnail: ilustrasi AI, lalu lukisan atau
// foto arsip, lalu peta dengan isi terbanyak (titik, panah, negara), lalu adegan pertama.
function pickScene(scenes: SceneProps[]) {
  const image = (type: string) => scenes.find((s) => s.visualType === type && s.asset?.kind === "IMAGE");
  const richness = (s: SceneProps) =>
    (s.graphic.map?.points.length ?? 0) +
    2 * (s.graphic.map?.arrows?.length ?? 0) +
    (s.graphic.map?.countries?.length ?? 0);
  const maps = scenes.filter((s) => s.visualType === "map" && s.graphic.map?.points.length);
  const bestMap = maps.sort((a, b) => richness(b) - richness(a))[0];
  return image("illustration") ?? image("painting") ?? image("archival_photo") ?? bestMap ?? scenes[0] ?? null;
}

// Teks thumbnail dari naskah (atau 4 kata pertama judul) dan tahun dari topik sebagai label.
export function buildThumbnailProps(
  video: HistoryVideoProps,
  project: { topic: string; thumbnailText: string | null },
): ThumbnailProps {
  const scene = pickScene(video.scenes);
  const text = project.thumbnailText?.trim() || video.title.split(/\s+/).slice(0, 4).join(" ");
  const year = `${project.topic} ${video.title}`.match(/\b(1\d{3}|20\d{2})\b/)?.[1] ?? null;
  return { text, kicker: year, scene, frames: scene ? msToFrames(scene.durationMs) : 1 };
}
