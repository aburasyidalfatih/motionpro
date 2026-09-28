import type { AssetCandidate, AssetProvider } from "./types";

// Penyedia tiruan untuk menguji alur tanpa jaringan (AI_PROVIDER=fake).
// File-nya dibuat sebagai gambar polos saat diunduh (lihat download.ts).

function candidates(query: string, limit: number, kind: "IMAGE" | "VIDEO"): AssetCandidate[] {
  return Array.from({ length: Math.min(limit, 4) }, (_, i) => ({
    kind: "IMAGE",
    provider: "fake",
    providerId: `${kind.toLowerCase()}-${query}-${i}`.slice(0, 120),
    title: `Contoh ${kind === "VIDEO" ? "footage" : "gambar"} ${i + 1}: ${query}`,
    originalUrl: `fake://${i}`,
    previewUrl: null,
    pageUrl: null,
    author: "Mode tiruan",
    license: "Contoh",
    width: 1920,
    height: 1080,
    durationMs: null,
  }));
}

// Kata kunci khusus untuk menguji tampilan storyboard: "kosong" tanpa hasil,
// "gagal" melempar error seperti sumber yang tidak bisa dihubungi.
function special(query: string) {
  if (query.startsWith("gagal")) throw new Error("sumber tiruan tidak bisa dihubungi");
  return query.startsWith("kosong");
}

export const fakeAssets: AssetProvider = {
  name: "fake",
  async searchImages(query, { limit }) {
    if (special(query)) return [];
    return candidates(query, limit, "IMAGE");
  },
  async searchVideos(query, { limit }) {
    if (special(query)) return [];
    return candidates(query, limit, "VIDEO");
  },
};
