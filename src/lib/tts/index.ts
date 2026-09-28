import { fatalError, geminiClient } from "@/lib/ai/client";
import { estimateDurationMs } from "@/lib/projects";
import { pcmDurationMs, tonePcm } from "./audio";

// Voice over dengan Gemini TTS. Model dan suara bisa diganti lewat .env dan
// halaman Audio; mode tiruan (AI_PROVIDER=fake) menghasilkan nada pengganti.

const DEFAULT_MODEL = "gemini-3.8-flash-tts";

export const DEFAULT_VOICE = "Charon";
export const DEFAULT_VOICE_STYLE =
  "Bacakan sebagai narator dokumenter sejarah: suara tenang dan berwibawa, tempo sedang, jeda wajar antar kalimat.";

// Beberapa suara bawaan Gemini yang cocok untuk narasi dokumenter.
export const VOICE_SUGGESTIONS = [
  { name: "Charon", note: "informatif" },
  { name: "Orus", note: "tegas" },
  { name: "Alnilam", note: "tegas" },
  { name: "Gacrux", note: "matang" },
  { name: "Sadaltager", note: "berpengetahuan" },
  { name: "Rasalgethi", note: "informatif" },
  { name: "Iapetus", note: "jernih" },
  { name: "Schedar", note: "stabil" },
  { name: "Algenib", note: "serak" },
  { name: "Kore", note: "tegas, perempuan" },
  { name: "Aoede", note: "ringan, perempuan" },
  { name: "Fenrir", note: "bersemangat" },
];

export type Speech = { pcm: Buffer; sampleRate: number };

// Instruksi gaya dan teks dipisah dengan struktur "catatan sutradara / transkrip"
// agar model TTS tidak ikut membacakan instruksinya.
function ttsPrompt(text: string, style: string) {
  if (!style.trim()) return text;
  return `### DIRECTOR'S NOTES\n${style.trim()}\n\n### TRANSCRIPT\n${text}`;
}

// Audio jauh lebih panjang dari perkiraan hampir pasti berarti instruksi ikut
// dibacakan (atau model mengarang tambahan).
function tooLong(speech: Speech, text: string) {
  const expected = estimateDurationMs(text);
  return pcmDurationMs(speech.pcm, speech.sampleRate) > Math.max(expected * 1.8, expected + 4_000);
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

  const model = process.env.GEMINI_TTS_MODEL || DEFAULT_MODEL;
  const speech = await generateSpeech(model, ttsPrompt(text, options.style), options.voice);
  if (!options.style.trim() || !tooLong(speech, text)) return speech;

  // Coba sekali lagi hanya dengan teks narasi, tanpa instruksi gaya.
  console.warn(`[tts] audio terlalu panjang untuk "${text.slice(0, 40)}...", diulang tanpa instruksi gaya`);
  const plain = await generateSpeech(model, text, options.voice);
  return pcmDurationMs(plain.pcm, plain.sampleRate) < pcmDurationMs(speech.pcm, speech.sampleRate) ? plain : speech;
}
