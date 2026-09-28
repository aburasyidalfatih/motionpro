import { readdir } from "node:fs/promises";
import { ApiError } from "@google/genai";
import { fatalError, geminiClient } from "@/lib/ai/client";
import { estimateDurationMs } from "@/lib/projects";
import { storagePath } from "@/lib/storage";
import { normalizeLoudness, speechBounds, tonePcm, trimEdgeNoise } from "./audio";

import { DEFAULT_VOICE } from "./voices";

export { DEFAULT_VOICE, VOICE_SAMPLE_TEXT, VOICE_STYLE_PRESETS, VOICES } from "./voices";

// Voice over dengan Gemini TTS. Model dan suara bisa diganti lewat .env dan
// halaman Audio; mode tiruan (AI_PROVIDER=fake) menghasilkan nada pengganti.

const DEFAULT_MODEL = "gemini-3.8-flash-tts";

// Tanpa instruksi gaya secara bawaan: model TTS kadang tetap membacakan
// instruksinya, dan suara seperti Charon sudah cocok untuk narasi dokumenter.
export const DEFAULT_VOICE_STYLE = "";
export const VOICE_STYLE_EXAMPLE = "Tenang dan berwibawa, tempo sedang";

// Suara dan gaya bicara narator proyek, dengan nilai bawaan.
export function projectVoice(project: { voiceId: string | null; voiceStyle: string | null }) {
  return { voice: project.voiceId || DEFAULT_VOICE, style: (project.voiceStyle || DEFAULT_VOICE_STYLE).trim() };
}

// Voice over yang dibuat dengan suara atau gaya bicara lain dari pengaturan
// proyek sekarang; campuran seperti ini terdengar tidak konsisten. Voice over
// lama tanpa catatan gaya (voiceStyle null) hanya dibandingkan suaranya.
export function isOutdatedVoiceover(
  voiceover: { voiceId: string; voiceStyle: string | null },
  current: { voice: string; style: string },
) {
  return (
    voiceover.voiceId !== current.voice || (voiceover.voiceStyle !== null && voiceover.voiceStyle !== current.style)
  );
}

export function ttsModel() {
  return process.env.AI_PROVIDER === "fake" ? "fake" : process.env.GEMINI_TTS_MODEL || DEFAULT_MODEL;
}

// Contoh suara disimpan per model, karena suara yang sama bisa berbeda antarmodel.
const samplesDir = () => `voice-samples/${ttsModel()}`;

export function voiceSamplePath(voice: string) {
  return `${samplesDir()}/${voice}.wav`;
}

// Nama suara yang contohnya sudah dibuat untuk model sekarang.
export async function listVoiceSamples() {
  const files = await readdir(storagePath(samplesDir())).catch(() => [] as string[]);
  return new Set(files.filter((f) => f.endsWith(".wav")).map((f) => f.slice(0, -4)));
}

export type Speech = { pcm: Buffer; sampleRate: number };

// Instruksi gaya dan teks dipisah dengan struktur "catatan sutradara / transkrip"
// agar model TTS tidak ikut membacakan instruksinya.
function ttsPrompt(text: string, style: string) {
  if (!style.trim()) return text;
  return `### DIRECTOR'S NOTES\n${style.trim()}\n\n### TRANSCRIPT\n${text}`;
}

// Lama bagian bersuara, tanpa hening di awal dan akhir.
function spokenMs(speech: Speech) {
  const { startMs, endMs } = speechBounds(speech.pcm, speech.sampleRate);
  return endMs - startMs;
}

// Ucapan yang lebih panjang dari narasi ditambah separuh panjang instruksi
// hampir pasti berarti instruksinya ikut dibacakan.
function readsStyle(speech: Speech, text: string, style: string) {
  return spokenMs(speech) > estimateDurationMs(text) * 1.15 + estimateDurationMs(style) * 0.5;
}

// Tiap adegan dibuat dengan panggilan TTS terpisah. Dengan temperature bawaan
// dan seed acak, nada, tempo, dan emosi narator berubah-ubah antaradegan;
// seed yang sama per proyek dan temperature lebih rendah membuatnya konsisten.
const TEMPERATURE = Number(process.env.GEMINI_TTS_TEMPERATURE) || 0.6;

// Seed tetap dari sebuah kunci (misalnya id proyek), dalam rentang int32.
export function voiceSeed(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return (hash >>> 0) % 2_147_483_647;
}

// Model TTS yang menolak temperature/seed dipanggil tanpa keduanya.
let samplingUnsupported = false;

async function generateSpeech(model: string, prompt: string, voice: string, seed: number): Promise<Speech> {
  const sampling = samplingUnsupported ? {} : { temperature: TEMPERATURE, seed };
  const response = await geminiClient()
    .generate(model, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        ...sampling,
      },
    })
    .catch((err) => {
      if (
        !samplingUnsupported &&
        err instanceof ApiError &&
        err.status === 400 &&
        /seed|temperature/i.test(err.message)
      ) {
        samplingUnsupported = true;
        console.warn(`[tts] ${model} tidak menerima temperature/seed; dipanggil tanpa keduanya`);
        return null;
      }
      throw fatalError(err, model);
    });
  if (!response) return generateSpeech(model, prompt, voice, seed);

  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("Gemini TTS tidak mengembalikan audio");
  // Format yang dikembalikan: PCM 16-bit mono, misalnya "audio/L16;codec=pcm;rate=24000".
  const rate = Number(part.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24_000);
  return { pcm: Buffer.from(part.inlineData.data, "base64"), sampleRate: rate };
}

// Percobaan dengan instruksi gaya sebelum menyerah dan membacakan tanpa gaya.
// Adegan tanpa gaya terdengar berbeda dari adegan lain, jadi itu jalan terakhir.
const STYLE_ATTEMPTS = 2;

export async function synthesize(
  text: string,
  options: { voice: string; style: string; seed: number },
): Promise<Speech> {
  if (process.env.AI_PROVIDER === "fake") {
    return { pcm: tonePcm(estimateDurationMs(text)), sampleRate: 24_000 };
  }

  const model = ttsModel();
  const clean = (speech: Speech) => {
    const trimmed = trimEdgeNoise(speech.pcm, speech.sampleRate);
    return { ...speech, pcm: normalizeLoudness(trimmed, speech.sampleRate) };
  };
  const generate = async (prompt: string, attempt: number) =>
    // Seed berbeda per percobaan: seed yang sama cenderung mengulang kesalahan yang sama.
    clean(await generateSpeech(model, prompt, options.voice, options.seed + attempt));

  if (!options.style.trim()) return generate(text, 0);
  let shortest: Speech | undefined;
  for (let attempt = 0; attempt < STYLE_ATTEMPTS; attempt++) {
    const speech = await generate(ttsPrompt(text, options.style), attempt);
    if (!readsStyle(speech, text, options.style)) return speech;
    if (!shortest || spokenMs(speech) < spokenMs(shortest)) shortest = speech;
    console.warn(`[tts] instruksi gaya ikut terbaca untuk "${text.slice(0, 40)}..." (percobaan ${attempt + 1})`);
  }

  // Jalan terakhir: hanya teks narasi, tanpa instruksi gaya.
  const plain = await generate(text, STYLE_ATTEMPTS);
  return shortest && spokenMs(shortest) <= spokenMs(plain) ? shortest : plain;
}
