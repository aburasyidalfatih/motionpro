import type { AssetKind } from "@/generated/prisma/client";

// Satu kandidat aset hasil pencarian, sebelum disimpan ke tabel Asset.
export type AssetCandidate = {
  kind: AssetKind;
  provider: string;
  providerId: string;
  title: string;
  // File yang diunduh sebelum render.
  originalUrl: string;
  // Gambar kecil untuk storyboard.
  previewUrl: string | null;
  // Halaman sumber untuk atribusi.
  pageUrl: string | null;
  author: string | null;
  license: string;
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type SearchOptions = { limit: number };

export interface AssetProvider {
  name: string;
  searchImages(query: string, options: SearchOptions): Promise<AssetCandidate[]>;
  searchVideos?(query: string, options: SearchOptions): Promise<AssetCandidate[]>;
}

// Identitas aplikasi yang diwajibkan Wikimedia untuk setiap permintaan API.
export const USER_AGENT = "MotionPro/0.1 (https://github.com/aburasyidalfatih/motionpro)";
