"use server";

import { refresh } from "next/cache";
import { db } from "@/lib/db";
import { applySettings, isApiKeyName, testApiKey } from "@/lib/settings";

export type ApiKeyFormState = { ok?: boolean; message?: string };

// Simpan, uji, atau hapus satu API key (tombol mengirim `intent`). Key yang
// disimpan langsung dipakai worker pada job berikutnya, tanpa restart.
export async function apiKeyAction(_prev: ApiKeyFormState, formData: FormData): Promise<ApiKeyFormState> {
  const name = String(formData.get("name") ?? "");
  const intent = String(formData.get("intent") ?? "save");
  if (!isApiKeyName(name)) return { ok: false, message: "Pengaturan tidak dikenal." };

  if (intent === "remove") {
    await db.setting.deleteMany({ where: { key: name } });
    await applySettings();
    refresh();
    return { ok: true, message: "Key dihapus dari aplikasi. Bila ada, key dari file .env dipakai lagi." };
  }

  if (intent === "test") {
    await applySettings();
    const current = process.env[name];
    if (!current) return { ok: false, message: "Belum ada key untuk diuji." };
    return testApiKey(name, current);
  }

  const value = String(formData.get("value") ?? "").trim();
  if (!value) return { ok: false, message: "Isi API key dulu." };
  if (/\s/.test(value)) return { ok: false, message: "API key tidak boleh berisi spasi." };
  // Tetap disimpan walau uji gagal (misalnya jaringan sedang terputus); pesannya ditampilkan.
  const test = await testApiKey(name, value);
  await db.setting.upsert({ where: { key: name }, create: { key: name, value }, update: { value } });
  await applySettings();
  refresh();
  return test.ok
    ? { ok: true, message: `Tersimpan. ${test.message}` }
    : { ok: false, message: `Tersimpan, tetapi uji gagal. ${test.message}` };
}
