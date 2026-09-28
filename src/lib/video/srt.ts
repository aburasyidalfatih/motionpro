import { sceneTimings, subtitleLines } from "@/remotion/history/timing";
import type { HistoryVideoProps } from "@/remotion/history/types";

function timestamp(ms: number) {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor((total % 3_600_000) / 60_000);
  const s = Math.floor((total % 60_000) / 1000);
  const pad = (n: number, width = 2) => String(n).padStart(width, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(total % 1000, 3)}`;
}

// F-28: file SRT dari waktu per kata, dengan pembagian baris yang sama seperti
// subtitle di video. Diunggah ke YouTube sebagai teks terjemahan.
export function buildSrt(props: HistoryVideoProps, fps: number) {
  const timings = sceneTimings(props);
  const cues: string[] = [];
  props.scenes.forEach((scene, i) => {
    const offsetMs = (timings[i].start / fps) * 1000;
    const lines = subtitleLines(scene.words);
    lines.forEach((line, j) => {
      const text = line.words.map((w) => w.word).join(" ");
      // Baris tetap tampil sebentar setelah selesai diucapkan, tanpa menimpa baris berikutnya.
      const endMs = Math.min(line.endMs + 200, lines[j + 1]?.startMs ?? Infinity);
      cues.push(
        `${cues.length + 1}\n${timestamp(offsetMs + line.startMs)} --> ${timestamp(offsetMs + endMs)}\n${text}\n`,
      );
    });
  });
  return cues.join("\n");
}
