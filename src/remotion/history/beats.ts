import { createContext, useContext } from "react";
import { useVideoConfig } from "remotion";
import type { Chart, SceneProps, Stat, TimelineMark, WordTiming } from "./types";

// Beat: saat sebuah elemen adegan (titik peta, angka, peristiwa, baris) muncul.
// Elemen muncul ketika narator menyebutnya, bukan semuanya di awal adegan,
// sehingga layar terus berubah mengikuti cerita. Waktu kata berasal dari
// voice over (perkiraan per kata, lihat lib/tts/audio.ts).

// Narasi adegan yang sedang digambar: waktu kata dan jarak (frame) dari awal
// visual adegan ke awal narasinya (visual mulai lebih awal karena transisi).
export type SceneSpeech = { words: WordTiming[]; offset: number };

export const SceneSpeechContext = createContext<SceneSpeech>({ words: [], offset: 0 });

// Alternatif teks penanda untuk satu elemen, dicoba berurutan: kata dari
// naskah (cue), lalu angka, tanggal, atau label elemen itu.
export type Cue = (string | number | undefined | null)[];

const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

const tokens = (text: string | number) => String(text).split(/\s+/).map(normalize).filter(Boolean);

// "prajurit" cocok dengan "prajuritnya"; kata pendek harus sama persis.
const matches = (word: string, token: string) => word === token || (token.length >= 4 && word.startsWith(token));

// Indeks kata pertama (mulai dari `from`) tempat penanda diucapkan. Dicoba
// seluruh frasa, lalu dua kata pertama, lalu kata pertama bila cukup khas.
function findCue(words: string[], cue: string[], from: number) {
  for (const length of [cue.length, Math.min(2, cue.length), 1]) {
    if (length === 0) continue;
    const part = cue.slice(0, length);
    if (length === 1 && part[0].length < 4 && !/\d/.test(part[0])) continue;
    for (let i = from; i + length <= words.length; i++) {
      if (part.every((token, j) => matches(words[i + j], token))) return i;
    }
  }
  return -1;
}

// Elemen tampil sedikit sebelum kata diucapkan agar mata sempat menangkapnya.
const LEAD_FRAMES = 4;
const MIN_GAP_FRAMES = 6;

// Frame kemunculan tiap elemen, berurutan. Elemen yang penandanya tidak
// ditemukan di narasi dibagi rata di antara elemen yang ditemukan; tanpa
// voice over semuanya dibagi rata di bagian awal adegan.
export function beatFrames(
  speech: SceneSpeech,
  cues: Cue[],
  fps: number,
  durationInFrames: number,
  range?: { start?: number; end?: number },
): number[] {
  if (cues.length === 0) return [];
  const toFrame = (ms: number) => speech.offset + (ms / 1000) * fps;
  const words = speech.words.map((w) => normalize(w.word));
  const spoken = speech.words.length > 0;
  const start = range?.start ?? (spoken ? toFrame(speech.words[0].startMs) : 10);
  const end = range?.end ?? (spoken ? toFrame(speech.words.at(-1)!.endMs) * 0.85 : durationInFrames * 0.6);

  let cursor = 0;
  const found = cues.map((alternatives) => {
    if (!spoken) return null;
    for (const alternative of alternatives) {
      if (alternative === undefined || alternative === null || alternative === "") continue;
      const index = findCue(words, tokens(alternative), cursor);
      if (index !== -1) {
        cursor = index + 1;
        return toFrame(speech.words[index].startMs) - LEAD_FRAMES;
      }
    }
    return null;
  });

  // Isi yang tidak ditemukan: rata di antara jangkar sebelum dan sesudahnya
  // (awal atau akhir rentang bila tidak ada jangkar).
  const frames: number[] = [];
  for (let i = 0; i < found.length; ) {
    if (found[i] !== null) {
      frames.push(found[i++]!);
      continue;
    }
    let j = i;
    while (j < found.length && found[j] === null) j++;
    const hasBefore = i > 0;
    const hasAfter = j < found.length;
    const before = hasBefore ? frames[i - 1] : start;
    const after = Math.max(before, hasAfter ? found[j]! : end);
    const segments = j - i + Number(hasBefore) + Number(hasAfter) - 1;
    for (let k = 0; k < j - i; k++) {
      frames.push(segments > 0 ? before + ((after - before) * (k + Number(hasBefore))) / segments : before);
    }
    i = j;
  }

  // Elemen pertama tidak menunggu terlalu lama agar layar tidak kosong setelah transisi.
  frames[0] = Math.min(frames[0], start + fps * 0.8);

  // Berurutan, tidak menumpuk, dan tetap di dalam adegan.
  const last = Math.max(4, durationInFrames - 12);
  let previous = -Infinity;
  return frames.map((frame) => {
    const value = Math.min(last, Math.max(4, frame, previous + MIN_GAP_FRAMES));
    previous = value;
    return Math.round(value);
  });
}

export function useBeats(cues: Cue[], range?: { start?: number; end?: number }) {
  const speech = useContext(SceneSpeechContext);
  const { fps, durationInFrames } = useVideoConfig();
  return beatFrames(speech, cues, fps, durationInFrames, range);
}

export function useSceneSpeech() {
  return useContext(SceneSpeechContext);
}

// Angka seperti di narasi: 40000 → "40000" (cocok dengan "40.000"), 3.5 → "35" ("3,5").
export const numberCue = (value: number) => String(value).replace(".", "");

// Penanda per jenis elemen; dipakai komponen grafis dan penjadwal efek suara
// agar keduanya menghitung beat yang sama.
export const statCues = (stats: Stat[]): Cue[] => stats.map((s) => [s.cue, numberCue(s.value), s.label]);
export const eventCues = (events: TimelineMark[]): Cue[] => events.map((e) => [e.cue, e.date, e.label]);
export const chartCues = (chart: Chart): Cue[] => chart.bars.map((b) => [b.cue, b.label, numberCue(b.value)]);

// Penanda elemen yang diberi efek suara "pop" saat muncul.
export function popCues(scene: SceneProps): Cue[] {
  const g = scene.graphic;
  if (scene.visualType === "stat" && g.stats) return statCues(g.stats);
  if (scene.visualType === "timeline" && g.events) return eventCues(g.events);
  if (scene.visualType === "chart" && g.chart) return chartCues(g.chart);
  return [];
}
