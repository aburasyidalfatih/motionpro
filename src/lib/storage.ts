import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

// Semua file (aset, audio, unggahan, hasil render) disimpan di STORAGE_DIR dan
// dirujuk dengan path relatif, misalnya "assets/abc.jpg". Nanti di VPS, modul
// ini yang diganti ke R2/S3 tanpa mengubah pemanggilnya.

export function storageRoot() {
  return path.resolve(env().STORAGE_DIR);
}

// Path absolut untuk path relatif; menolak path yang keluar dari root.
export function resolveInside(root: string, relative: string) {
  const absolute = path.resolve(root, relative);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) {
    throw new Error(`Path di luar folder penyimpanan: ${relative}`);
  }
  return absolute;
}

export function storagePath(relative: string) {
  return resolveInside(storageRoot(), relative);
}

export async function saveFile(relative: string, data: Buffer | Uint8Array) {
  const absolute = storagePath(relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  return relative;
}

// URL untuk memutar atau menampilkan file di browser (lihat app/api/files).
export function fileUrl(relative: string) {
  return `/api/files/${relative.split(path.sep).join("/")}`;
}
