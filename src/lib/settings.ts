import { resetScriptAI } from "@/lib/ai";
import { resetGeminiClient } from "@/lib/ai/client";
import { db } from "@/lib/db";

// API key yang bisa diisi dari halaman Pengaturan. Nilai di database
// didahulukan; bila kosong, nilai dari .env dipakai. Kode lain tetap membaca
// process.env, jadi applySettings() dipanggil worker sebelum tiap job dan oleh
// halaman yang membutuhkannya.
export const API_KEYS = ["GEMINI_API_KEY", "PEXELS_API_KEY"] as const;
export type ApiKeyName = (typeof API_KEYS)[number];

export const isApiKeyName = (name: string): name is ApiKeyName => (API_KEYS as readonly string[]).includes(name);

// Nilai dari .env saat proses mulai, dipakai lagi bila key di Pengaturan dihapus.
const fromEnv: Record<ApiKeyName, string | undefined> = {
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  PEXELS_API_KEY: process.env.PEXELS_API_KEY,
};

let applied: string | undefined;

export async function applySettings() {
  const rows = await db.setting.findMany({ where: { key: { in: [...API_KEYS] } } });
  for (const key of API_KEYS) {
    const value = rows.find((r) => r.key === key)?.value || fromEnv[key];
    if (value) process.env[key] = value;
    else delete process.env[key];
  }
  // Klien Gemini menyimpan key lama; buat ulang bila key berubah.
  const signature = API_KEYS.map((key) => process.env[key] ?? "").join("\n");
  if (applied !== undefined && signature !== applied) {
    resetGeminiClient();
    resetScriptAI();
  }
  applied = signature;
}

export type ApiKeyStatus = {
  name: ApiKeyName;
  // Sumber nilai yang dipakai sekarang.
  source: "settings" | "env" | "none";
  // Hanya 4 karakter terakhir yang dikirim ke browser.
  masked: string | null;
  updatedAt: Date | null;
};

const mask = (value: string) => `••••••••${value.slice(-4)}`;

export async function apiKeyStatuses(): Promise<ApiKeyStatus[]> {
  const rows = await db.setting.findMany({ where: { key: { in: [...API_KEYS] } } });
  return API_KEYS.map((name): ApiKeyStatus => {
    const row = rows.find((r) => r.key === name);
    if (row?.value) return { name, source: "settings", masked: mask(row.value), updatedAt: row.updatedAt };
    const env = fromEnv[name];
    return env
      ? { name, source: "env", masked: mask(env), updatedAt: null }
      : { name, source: "none", masked: null, updatedAt: null };
  });
}

// Menguji key dengan panggilan ringan ke layanannya; mengembalikan pesan untuk pengguna.
export async function testApiKey(name: ApiKeyName, value: string): Promise<{ ok: boolean; message: string }> {
  try {
    if (name === "GEMINI_API_KEY") {
      // Daftar model tidak memakai kuota generate.
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", {
        headers: { "x-goog-api-key": value },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) return { ok: true, message: "Terhubung ke Gemini." };
      const body = (await response.json().catch(() => null)) as { error?: { message?: string } } | null;
      return {
        ok: false,
        message: `Gemini menolak key (${response.status}): ${body?.error?.message ?? "tidak valid"}`,
      };
    }
    const response = await fetch("https://api.pexels.com/v1/search?query=battle&per_page=1", {
      headers: { Authorization: value },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.ok) return { ok: true, message: "Terhubung ke Pexels." };
    return { ok: false, message: `Pexels menolak key (${response.status}).` };
  } catch (err) {
    return {
      ok: false,
      message: `Tidak bisa menghubungi layanan: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
