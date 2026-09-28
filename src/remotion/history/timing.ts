import type { HistoryVideoProps, WordTiming } from "./types";

export const FPS = 30;
// Lama crossfade antaradegan; visual adegan berikutnya mulai sedikit lebih awal
// sehingga narasi tidak ikut bergeser.
export const CROSSFADE_FRAMES = 12;
// Jeda di akhir video untuk fade ke hitam dan musik mereda.
export const END_HOLD_FRAMES = 45;

export const msToFrames = (ms: number) => Math.max(1, Math.round((ms / 1000) * FPS));

export type SceneTiming = { start: number; frames: number };

export function sceneTimings(props: Pick<HistoryVideoProps, "scenes">): SceneTiming[] {
  let cursor = 0;
  return props.scenes.map((scene) => {
    const frames = msToFrames(scene.durationMs);
    const timing = { start: cursor, frames };
    cursor += frames;
    return timing;
  });
}

export function totalFrames(props: Pick<HistoryVideoProps, "scenes">) {
  const timings = sceneTimings(props);
  const last = timings.at(-1);
  return (last ? last.start + last.frames : FPS) + END_HOLD_FRAMES;
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
