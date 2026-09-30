import type { HistoryVideoProps, WordTiming } from "./types";

export const FPS = 30;
// Lama transisi antaradegan; visual adegan berikutnya mulai sedikit lebih awal
// sehingga narasi tidak ikut bergeser.
export const CROSSFADE_FRAMES = 14;
// Jeda di akhir video untuk fade ke hitam dan musik mereda.
export const END_HOLD_FRAMES = 45;

export const msToFrames = (ms: number) => Math.max(1, Math.round((ms / 1000) * FPS));

export type SceneTiming = { start: number; frames: number };

export function sceneTimings(props: { scenes: { durationMs: number }[] }): SceneTiming[] {
  let cursor = 0;
  return props.scenes.map((scene) => {
    const frames = msToFrames(scene.durationMs);
    const timing = { start: cursor, frames };
    cursor += frames;
    return timing;
  });
}

// End screen YouTube (20 detik) setelah isi video, bila diaktifkan.
export const END_SCREEN_FRAMES = 20 * FPS;

// Akhir isi video (adegan terakhir ditambah jeda fade), sebelum end screen.
export function contentFrames(props: Pick<HistoryVideoProps, "scenes">) {
  const timings = sceneTimings(props);
  const last = timings.at(-1);
  return (last ? last.start + last.frames : FPS) + END_HOLD_FRAMES;
}

export function totalFrames(props: Pick<HistoryVideoProps, "scenes"> & { endScreen?: boolean }) {
  return contentFrames(props) + (props.endScreen ? END_SCREEN_FRAMES : 0);
}

// Rentang bicara global (dalam frame), untuk menurunkan volume musik saat narasi.
export function speechRanges(props: Pick<HistoryVideoProps, "scenes">) {
  return sceneTimings(props).flatMap(({ start }, i) => {
    const words = props.scenes[i].words;
    if (!props.scenes[i].narrationSrc || words.length === 0) return [];
    return [[start + (words[0].startMs / 1000) * FPS, start + (words.at(-1)!.endMs / 1000) * FPS] as const];
  });
}

export type SubtitleLine = { words: WordTiming[]; startMs: number; endMs: number };

// Kata dikelompokkan menjadi baris pendek: maksimal 6 kata atau berhenti di
// akhir kalimat/koma, agar mudah dibaca di layar dan di file SRT.
export function subtitleLines(words: WordTiming[], maxWords = 6): SubtitleLine[] {
  const lines: SubtitleLine[] = [];
  let current: WordTiming[] = [];
  const flush = () => {
    if (current.length) {
      lines.push({ words: current, startMs: current[0].startMs, endMs: current.at(-1)!.endMs });
      current = [];
    }
  };
  for (const word of words) {
    current.push(word);
    const breakHere = /[.!?]$/.test(word.word) || (/[,;:]$/.test(word.word) && current.length >= 4);
    if (breakHere || current.length >= maxWords) flush();
  }
  flush();
  return lines;
}

// Jenis transisi masuk adegan. Bervariasi menurut isi adegan agar 60+ potongan
// dalam satu video tidak terasa sama: peta masuk dengan zoom, angka dan grafik
// dengan sapuan, kartu judul dengan fade, sisanya bergantian geser dan fade.
export type TransitionKind = "fade" | "slide" | "zoom" | "wipe";

export function transitionFor(scenes: Pick<HistoryVideoProps, "scenes">["scenes"], index: number): TransitionKind {
  const type = scenes[index].visualType;
  if (type === "title") return "fade";
  if (type === "map") return scenes[index - 1]?.visualType === "map" ? "fade" : "zoom";
  if (["stat", "chart", "comparison"].includes(type)) return "wipe";
  if (scenes[index - 1]?.visualType === type) return "fade";
  return index % 2 === 0 ? "slide" : "fade";
}

// Adegan bertipe "title" pertama adalah judul video; berikutnya pembuka bab
// (bab 1, 2, ...). Mengembalikan nomor bab tiap adegan judul, 0 untuk judul video.
export function chapterNumbers(scenes: Pick<HistoryVideoProps, "scenes">["scenes"]) {
  let count = -1;
  return scenes.map((scene) => (scene.visualType === "title" ? ++count : null));
}
