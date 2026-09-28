import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { resolveInside } from "@/lib/storage";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".srt": "application/x-subrip; charset=utf-8",
};

// Menyajikan file dari folder lokal dengan dukungan Range, agar audio dan video
// bisa di-seek di browser.
// downloadName diisi untuk memaksa browser mengunduh file dengan nama tersebut.
export async function serveFile(root: string, segments: string[], request: Request, downloadName?: string | null) {
  let absolute: string;
  try {
    absolute = resolveInside(root, segments.map(decodeURIComponent).join("/"));
  } catch {
    return new Response("Tidak ditemukan", { status: 404 });
  }
  const info = await stat(absolute).catch(() => null);
  if (!info?.isFile()) return new Response("Tidak ditemukan", { status: 404 });

  const headers = new Headers({
    "Content-Type": CONTENT_TYPES[path.extname(absolute).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
  });
  if (downloadName) {
    const ascii = downloadName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
    headers.set("Content-Disposition", `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(downloadName)}`);
  }

  const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
    if (start > end || start >= info.size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(createReadStream(absolute, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }

  headers.set("Content-Length", String(info.size));
  return new Response(Readable.toWeb(createReadStream(absolute)) as ReadableStream, { headers });
}
