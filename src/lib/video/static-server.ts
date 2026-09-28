import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Readable } from "node:stream";
import { libraryRoot } from "@/lib/library";
import { serveFile } from "@/lib/serve-file";
import { storageRoot } from "@/lib/storage";
import type { UrlResolver } from "./props";

// Saat render, Chrome milik Remotion memuat gambar, video, dan audio lewat HTTP.
// Worker menjalankan server kecil ini sendiri agar render tidak bergantung pada
// aplikasi web yang sedang berjalan.
export async function startStaticServer(): Promise<{ urls: UrlResolver; close: () => Promise<void> }> {
  const server: Server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const [scope, ...segments] = url.pathname.split("/").filter(Boolean);
      const root = scope === "files" ? storageRoot() : scope === "library" ? libraryRoot() : null;
      if (!root) {
        res.writeHead(404).end();
        return;
      }
      const request = new Request(url, { headers: req.headers as Record<string, string> });
      const response = await serveFile(root, segments, request);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body as never).pipe(res);
      else res.end();
    } catch {
      res.writeHead(500).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const encode = (relative: string) => relative.split(/[\\/]/).map(encodeURIComponent).join("/");
  return {
    urls: {
      file: (relative) => `${base}/files/${encode(relative)}`,
      library: (relative) => `${base}/library/${encode(relative)}`,
    },
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
