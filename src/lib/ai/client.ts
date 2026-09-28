import { ApiError, GoogleGenAI } from "@google/genai";
import { UnrecoverableError } from "bullmq";

// Klien Gemini bersama untuk teks (riset, naskah) dan suara (TTS), termasuk
// penanganan kuota dan error yang sama untuk keduanya.

const MAX_ATTEMPTS = 4;
const MAX_WAIT_MS = 90_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Google menyertakan RetryInfo, misalnya "retryDelay": "37s", saat batas per menit tercapai.
function retryDelayMs(message: string) {
  const match = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.min(Number(match[1]) * 1000 + 1000, MAX_WAIT_MS) : undefined;
}

// Kuota harian atau model tanpa kuota gratis (limit 0) tidak pulih dengan menunggu sebentar.
function isHardQuota(message: string) {
  return /PerDay|limit: 0\b/.test(message);
}

// Error permintaan (key salah, model tidak ada, permintaan ditolak) tidak
// pulih dengan dicoba ulang; tampilkan pesan yang bisa ditindaklanjuti.
export function fatalError(err: unknown, model: string) {
  if (!(err instanceof ApiError)) return err;
  const detail = err.message.match(/"message"\s*:\s*"([^"]+)"/)?.[1] ?? err.message;
  if (err.status === 404) {
    return new UnrecoverableError(`Model Gemini "${model}" tidak ditemukan. Ganti nama model di .env. (${detail})`);
  }
  if (err.status === 400 || err.status === 401 || err.status === 403) {
    return new UnrecoverableError(`Gemini menolak permintaan (${err.status}): ${detail}`);
  }
  return err;
}

function quotaError(model: string) {
  return new UnrecoverableError(
    `Kuota Gemini untuk model ${model} habis (error 429). Cek pemakaian di https://aistudio.google.com/usage. ` +
      "Pilihan: tunggu kuota pulih, aktifkan billing di Google AI Studio, atau ganti model di .env.",
  );
}

export type GeminiRequest = Omit<Parameters<GoogleGenAI["models"]["generateContent"]>[0], "model">;

let client: GoogleGenAI | undefined;

export function geminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Tidak ada gunanya dicoba ulang sampai .env diperbaiki.
    throw new UnrecoverableError("GEMINI_API_KEY belum diisi di .env (buat di https://aistudio.google.com)");
  }
  client ??= new GoogleGenAI({ apiKey });
  const ai = client;

  // Batas per menit (429) dan server sibuk (503) ditunggu lalu dicoba lagi di sini,
  // agar satu panggilan tidak menggagalkan seluruh job.
  async function generate(model: string, request: GeminiRequest) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await ai.models.generateContent({ model, ...request });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status !== 429 && status !== 503) throw err;
        const message = err instanceof Error ? err.message : "";
        if (status === 429 && isHardQuota(message)) throw quotaError(model);
        if (attempt >= MAX_ATTEMPTS) {
          if (status === 429) throw quotaError(model);
          throw err;
        }
        const wait = retryDelayMs(message) ?? 15_000 * attempt;
        console.warn(`[gemini] ${status}, menunggu ${Math.round(wait / 1000)} detik (percobaan ${attempt})`);
        await sleep(wait);
      }
    }
  }

  return { generate };
}
