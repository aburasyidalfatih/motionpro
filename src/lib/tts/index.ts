import { readdir } from "node:fs/promises";
import { fatalError, geminiClient } from "@/lib/ai/client";
import { estimateDurationMs } from "@/lib/projects";
import { storagePath } from "@/lib/storage";
import { speechBounds, tonePcm, trimEdgeNoise } from "./audio";

export { DEFAULT_VOICE, VOICE_SAMPLE_TEXT, VOICE_STYLE_PRESETS, VOICES } from "./voices";

// Voice over dengan Gemini TTS. Model dan suara bisa diganti lewat .env dan
// halaman Audio; mode tiruan (AI_PROVIDER=fake) menghasilkan nada pengganti.

const DEFAULT_MODEL = "gemini-3.8-flash-tts";

// Tanpa instruksi gaya secara bawaan: model TTS kadang tetap membacakan
// instruksinya, dan suara seperti Charon sudah cocok untuk narasi dokumenter.
export const DEFAULT_VOICE_STYLE = "";
export const VOICE_STYLE_EXAMPLE = "Tenang dan berwibawa, tempo sedang";

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

async function generateSpeech(model: string, prompt: string, voice: string): Promise<Speech> {
  const response = await geminiClient()
    .generate(model, {
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      },
    })
    .catch((err) => {
      throw fatalError(err, model);
    });

  const part = response.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data);
  if (!part?.inlineData?.data) throw new Error("Gemini TTS tidak mengembalikan audio");
  // Format yang dikembalikan: PCM 16-bit mono, misalnya "audio/L16;codec=pcm;rate=24000".
  const rate = Number(part.inlineData.mimeType?.match(/rate=(\d+)/)?.[1] ?? 24_000);
  return { pcm: Buffer.from(part.inlineData.data, "base64"), sampleRate: rate };
}

export async function synthesize(text: string, options: { voice: string; style: string }): Promise<Speech> {
  if (process.env.AI_PROVIDER === "fake") {
    return { pcm: tonePcm(estimateDurationMs(text)), sampleRate: 24_000 };
  }

  const model = ttsModel();
  const clean = (speech: Speech) => ({ ...speech, pcm: trimEdgeNoise(speech.pcm, speech.sampleRate) });
  const speech = clean(await generateSpeech(model, ttsPrompt(text, options.style), options.voice));
  if (!options.style.trim() || !readsStyle(speech, text, options.style)) return speech;

  // Coba sekali lagi hanya dengan teks narasi, tanpa instruksi gaya.
  console.warn(`[tts] instruksi gaya ikut terbaca untuk "${text.slice(0, 40)}...", diulang tanpa instruksi`);
  const plain = clean(await generateSpeech(model, text, options.voice));
  return spokenMs(plain) < spokenMs(speech) ? plain : speech;
}
