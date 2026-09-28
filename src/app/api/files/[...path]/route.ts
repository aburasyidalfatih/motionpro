import { serveFile } from "@/lib/serve-file";
import { storageRoot } from "@/lib/storage";

// File di STORAGE_DIR: aset, voice over, unggahan, video. ?download=nama.mp4 memaksa unduhan.
export async function GET(request: Request, { params }: RouteContext<"/api/files/[...path]">) {
  const { path } = await params;
  const download = new URL(request.url).searchParams.get("download");
  return serveFile(storageRoot(), path, request, download);
}
