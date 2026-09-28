import { fatalError, geminiClient } from "@/lib/ai/client";
import { estimateDurationMs } from "@/lib/projects";
import { tonePcm } from "./audio";

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

export async function synthesize(text: string, options: { voice: string; style: string }): Promise<Speech> {
  if (process.env.AI_PROVIDER === "fake") {
    return { pcm: tonePcm(estimateDurationMs(text)), sampleRate: 24_000 };
  }

  const model = process.env.GEMINI_TTS_MODEL || DEFAULT_MODEL;
  const response = await geminiClient()
    .generate(model, {
      contents: [{ role: "user", parts: [{ text: `${options.style}\n\n${text}` }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: options.voice } } },
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
