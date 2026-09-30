import { createFakeAI } from "./fake";
import { createGeminiAI } from "./gemini";
import type { ScriptAI } from "./types";

let instance: ScriptAI | undefined;

// Dipanggil saat API key diganti dari halaman Pengaturan: instance Gemini
// menyimpan klien lama.
export function resetScriptAI() {
  instance = undefined;
}

// AI_PROVIDER=fake menjalankan alur dengan data contoh, tanpa memanggil Gemini.
export function scriptAI(): ScriptAI {
  instance ??= process.env.AI_PROVIDER === "fake" ? createFakeAI() : createGeminiAI();
  return instance;
}

// Jumlah panggilan riset paralel. Akun gratis Gemini punya batas per menit yang
// kecil, jadi default-nya satu per satu; naikkan bila billing aktif.
export function aiConcurrency() {
  return Math.max(1, Number(process.env.GEMINI_CONCURRENCY) || 1);
}
