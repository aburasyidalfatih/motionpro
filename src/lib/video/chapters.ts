import { chapterNumbers, sceneTimings } from "@/remotion/history/timing";
import type { HistoryVideoProps } from "@/remotion/history/types";

// Syarat chapter YouTube: dimulai 0:00, minimal 3 chapter, tiap chapter minimal 10 detik.
const MIN_CHAPTERS = 3;
const MIN_CHAPTER_MS = 10_000;

function timestamp(ms: number) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

// Daftar chapter untuk deskripsi YouTube dari kartu bab (adegan "title"
// setelah judul video). Null bila video tidak punya cukup bab.
export function buildChapters(props: HistoryVideoProps, fps: number): string | null {
  const timings = sceneTimings(props);
  const numbers = chapterNumbers(props.scenes);
  const chapters = [{ ms: 0, title: "Pembuka" }];
  props.scenes.forEach((scene, i) => {
    if (!numbers[i]) return;
    const ms = (timings[i].start / fps) * 1000;
    const title = `Bab ${numbers[i]}: ${scene.onScreenText || props.title}`;
    // Bab yang terlalu dekat dengan chapter sebelumnya digabung ke sana.
    if (ms - chapters.at(-1)!.ms < MIN_CHAPTER_MS) {
      if (chapters.length > 1) chapters[chapters.length - 1].title = title;
      return;
    }
    chapters.push({ ms, title });
  });
  if (chapters.length < MIN_CHAPTERS) return null;
  return chapters.map((c) => `${timestamp(c.ms)} ${c.title}`).join("\n");
}
