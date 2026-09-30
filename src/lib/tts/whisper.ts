import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { transcribe, type WhisperModel } from "@remotion/install-whisper-cpp";
import { pcmToWav, type WordTiming } from "./audio";

// Waktu per kata dari Whisper (whisper.cpp lokal, lewat @remotion/install-whisper-cpp).
// Whisper mendengarkan audio voice over dan memberi waktu tiap kata; hasilnya
// dicocokkan dengan teks narasi, karena kata yang didengar Whisper bisa sedikit
// berbeda ejaannya. Aktif bila WHISPER_MODEL diisi dan `npm run whisper:setup`
// sudah dijalankan.

// Versi 1.5.5 punya waktu per token (DTW) dan tersedia siap pakai untuk Windows.
export const WHISPER_CPP_VERSION = process.env.WHISPER_CPP_VERSION || "1.5.5";

export function whisperConfig() {
  const model = process.env.WHISPER_MODEL?.trim();
  if (!model) return null;
  return { model: model as WhisperModel, dir: path.resolve(process.env.WHISPER_DIR || "./whisper") };
}

const WHISPER_RATE = 16_000;

// Whisper hanya menerima WAV 16 kHz; TTS Gemini 24 kHz diubah dengan interpolasi linear.
function resample16k(pcm: Buffer, sampleRate: number) {
  if (sampleRate === WHISPER_RATE) return pcm;
  const input = pcm.length / 2;
  const output = Math.floor((input * WHISPER_RATE) / sampleRate);
  const out = Buffer.alloc(output * 2);
  for (let i = 0; i < output; i++) {
    const position = (i * sampleRate) / WHISPER_RATE;
    const j = Math.floor(position);
    const a = pcm.readInt16LE(Math.min(j, input - 1) * 2);
    const b = pcm.readInt16LE(Math.min(j + 1, input - 1) * 2);
    out.writeInt16LE(Math.round(a + (b - a) * (position - j)), i * 2);
  }
  return out;
}

const normalize = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// Kemiripan dua kata 0–1 (jarak Levenshtein), agar "Mallaby" cocok dengan "Malabi".
function similarity(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = next;
    }
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}

type Heard = { word: string; startMs: number };

// Pasangan (kata narasi, kata Whisper) yang cocok, lewat penjajaran urutan
// seperti diff: kata yang mirip dipasangkan, sisanya dilewati.
export function alignHeard(words: string[], heard: Heard[]) {
  const a = words.map(normalize);
  const b = heard.map((h) => normalize(h.word));
  const score = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      const match = similarity(a[i], b[j]) >= 0.6 ? score[i + 1][j + 1] + 1 : -Infinity;
      score[i][j] = Math.max(match, score[i + 1][j], score[i][j + 1]);
    }
  }
  const pairs: { word: number; startMs: number }[] = [];
  for (let i = 0, j = 0; i < a.length && j < b.length; ) {
    if (similarity(a[i], b[j]) >= 0.6 && score[i][j] === score[i + 1][j + 1] + 1) {
      pairs.push({ word: i, startMs: heard[j].startMs });
      i++;
      j++;
    } else if (score[i + 1][j] >= score[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

// Waktu kata dari Whisper, diikat ke perkiraan berbasis jeda: kata yang cocok
// memakai waktu Whisper, kata di antaranya digeser mengikuti kata cocok di
// sekitarnya (pemetaan waktu linear sepotong-sepotong).
export function applyHeard(estimate: WordTiming[], pairs: { word: number; startMs: number }[]): WordTiming[] {
  const anchors = pairs.filter((p, i) => i === 0 || p.startMs > pairs[i - 1].startMs);
  if (anchors.length < 2) return estimate;
  const warp = (ms: number) => {
    let k = anchors.findIndex((a) => estimate[a.word].startMs > ms);
    if (k === -1) k = anchors.length - 1;
    k = Math.max(1, k);
    const [a, b] = [anchors[k - 1], anchors[k]];
    const [x0, x1] = [estimate[a.word].startMs, estimate[b.word].startMs];
    return x1 === x0 ? a.startMs : a.startMs + ((ms - x0) * (b.startMs - a.startMs)) / (x1 - x0);
  };
  const starts = estimate.map((w) => Math.max(0, Math.round(warp(w.startMs))));
  return estimate.map((w, i) => ({
    word: w.word,
    startMs: starts[i],
    endMs: Math.max(
      starts[i] + 1,
      Math.round(i + 1 < estimate.length ? Math.min(warp(w.endMs), starts[i + 1]) : warp(w.endMs)),
    ),
  }));
}

export async function whisperWordTimings(
  estimate: WordTiming[],
  pcm: Buffer,
  sampleRate: number,
  language: string,
): Promise<WordTiming[]> {
  const config = whisperConfig();
  if (!config) return estimate;
  const dir = await mkdtemp(path.join(tmpdir(), "motionpro-whisper-"));
  try {
    const input = path.join(dir, "speech.wav");
    await writeFile(input, pcmToWav(resample16k(pcm, sampleRate), WHISPER_RATE));
    const result = await transcribe({
      inputPath: input,
      whisperPath: config.dir,
      whisperCppVersion: WHISPER_CPP_VERSION,
      model: config.model,
      modelFolder: config.dir,
      tokenLevelTimestamps: true,
      language: language === "en" ? "en" : "id",
      printOutput: false,
    });
    // Token berawalan spasi memulai kata baru; token khusus seperti [_BEG_] dilewati.
    const heard: Heard[] = [];
    for (const item of result.transcription) {
      for (const token of item.tokens) {
        if (token.text.startsWith("[_") || !token.text.trim()) continue;
        const startMs = token.t_dtw >= 0 ? token.t_dtw * 10 : token.offsets.from;
        if (token.text.startsWith(" ") || heard.length === 0) heard.push({ word: token.text.trim(), startMs });
        else heard[heard.length - 1].word += token.text;
      }
    }
    return applyHeard(
      estimate,
      alignHeard(
        estimate.map((w) => w.word),
        heard,
      ),
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
