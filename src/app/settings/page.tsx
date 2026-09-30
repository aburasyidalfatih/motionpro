import { connection } from "next/server";
import { apiKeyStatuses, type ApiKeyName, type ApiKeyStatus } from "@/lib/settings";
import { ApiKeyForm } from "./ApiKeyForm";

const KEYS: Record<
  ApiKeyName,
  { title: string; description: string; link: string; linkLabel: string; placeholder: string }
> = {
  GEMINI_API_KEY: {
    title: "Gemini API key",
    description:
      "Wajib. Dipakai untuk riset, naskah, voice over, ilustrasi AI, dan pemeriksaan hasil render. Buka Google AI Studio, pilih Get API key, lalu Create API key.",
    link: "https://aistudio.google.com/apikey",
    linkLabel: "Buat di Google AI Studio",
    placeholder: "AIza...",
  },
  PEXELS_API_KEY: {
    title: "Pexels API key",
    description:
      "Opsional. Footage video dan foto suasana untuk gaya arsip. Tanpa key ini, adegan footage memakai gambar dari Wikimedia Commons.",
    link: "https://www.pexels.com/api/",
    linkLabel: "Buat gratis di Pexels",
    placeholder: "Key Pexels",
  },
};

function sourceLabel(status: ApiKeyStatus) {
  if (status.source === "settings") {
    const when = status.updatedAt?.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
    return `Tersimpan di aplikasi (${status.masked}), diubah ${when}`;
  }
  if (status.source === "env") return `Dari file .env (${status.masked}). Isi di sini untuk menggantinya.`;
  return "Belum diisi";
}

export default async function SettingsPage() {
  await connection();
  const statuses = await apiKeyStatuses();
  const fake = process.env.AI_PROVIDER === "fake";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Pengaturan</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          API key disimpan di database aplikasi ini dan langsung dipakai untuk job berikutnya, tanpa restart. Key tidak
          pernah ditampilkan utuh, hanya 4 karakter terakhirnya.
        </p>
      </div>

      {fake && (
        <p className="rounded-md border border-amber-300 p-3 text-sm text-amber-700 dark:border-amber-800 dark:text-amber-400">
          <code>AI_PROVIDER=fake</code> aktif di file .env, jadi aplikasi memakai data tiruan dan tidak memanggil
          Gemini. Hapus baris itu lalu restart web dan worker untuk memakai API key di bawah.
        </p>
      )}

      <ul className="space-y-4">
        {statuses.map((status) => {
          const info = KEYS[status.name];
          return (
            <li key={status.name} className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">{info.title}</h2>
                  <p className="text-xs text-zinc-500">
                    <code>{status.name}</code>
                  </p>
                </div>
                <span
                  className={`flex items-center gap-2 text-xs ${status.source === "none" ? "text-zinc-500" : "text-emerald-700 dark:text-emerald-400"}`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${status.source === "none" ? "bg-zinc-400" : "bg-green-500"}`}
                    aria-hidden
                  />
                  {sourceLabel(status)}
                </span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {info.description}{" "}
                <a href={info.link} target="_blank" rel="noreferrer" className="underline">
                  {info.linkLabel}
                </a>
                .
              </p>
              <ApiKeyForm
                name={status.name}
                placeholder={info.placeholder}
                hasValue={status.source !== "none"}
                removable={status.source === "settings"}
              />
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-zinc-500">
        Aplikasi belum punya login (Fase 4), jadi siapa pun yang bisa membuka aplikasi ini bisa mengganti key. Jangan
        buka akses aplikasi ke internet sebelum login tersedia.
      </p>
    </div>
  );
}
