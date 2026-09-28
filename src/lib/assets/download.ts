import sharp from "sharp";
import type { Asset } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { saveFile } from "@/lib/storage";
import { USER_AGENT } from "./types";

const MAX_BYTES = 300 * 1024 * 1024;

const MAX_WIDTH = 2560;
const MAX_HEIGHT = 1440;

// Gambar disimpan sebagai JPEG seukuran 2560×1440 (muat di dalamnya): cukup
// tajam untuk efek ken-burns di video 1080p, tapi jauh lebih ringan daripada
// file asli arsip. Gambar yang lebih kecil diperbesar di sini dengan lanczos3
// dan sedikit dipertajam, hasilnya lebih halus daripada diperbesar Chrome saat render.
export async function processImage(input: Buffer) {
  const image = sharp(input).rotate();
  const { width = 0, height = 0, orientation = 1 } = await image.metadata();
  // Orientasi EXIF 5–8 memutar gambar 90°, jadi lebar dan tinggi bertukar.
  const [w, h] = orientation >= 5 ? [height, width] : [width, height];
  const enlarged = w > 0 && h > 0 && w < MAX_WIDTH && h < MAX_HEIGHT;

  let pipeline = image
    .resize({ width: MAX_WIDTH, height: MAX_HEIGHT, fit: "inside", kernel: "lanczos3" })
    .flatten({ background: "#ffffff" });
  if (enlarged) pipeline = pipeline.sharpen({ sigma: 0.7 });
  const output = await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer({ resolveWithObject: true });
  return { data: output.data, width: output.info.width, height: output.info.height };
}

async function fetchFile(url: string) {
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`Unduhan gagal (${response.status}): ${url}`);
  const size = Number(response.headers.get("content-length") ?? 0);
  if (size > MAX_BYTES) throw new Error(`File terlalu besar (${Math.round(size / 1e6)} MB): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

// Gambar polos berwarna untuk mode tiruan.
function placeholder(seed: string) {
  const hue = [...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return sharp({
    create: { width: 1920, height: 1080, channels: 3, background: `hsl(${hue}, 35%, 35%)` },
  })
    .jpeg()
    .toBuffer();
}

// F-17: mengunduh aset terpilih ke penyimpanan lokal (sekali per aset).
export async function ensureLocal(asset: Asset): Promise<Asset> {
  if (asset.localPath) return asset;
  if (!asset.originalUrl) throw new Error(`Aset ${asset.id} tidak punya URL unduhan`);

  const raw = asset.provider === "fake" ? await placeholder(asset.id) : await fetchFile(asset.originalUrl);

  if (asset.kind === "VIDEO") {
    const localPath = await saveFile(`assets/${asset.id}.mp4`, raw);
    return db.asset.update({ where: { id: asset.id }, data: { localPath } });
  }
  const image = await processImage(raw);
  const localPath = await saveFile(`assets/${asset.id}.jpg`, image.data);
  return db.asset.update({
    where: { id: asset.id },
    data: { localPath, width: image.width, height: image.height },
  });
}
