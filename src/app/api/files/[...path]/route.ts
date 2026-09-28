import { serveFile } from "@/lib/serve-file";
import { storageRoot } from "@/lib/storage";

// File di STORAGE_DIR: aset, voice over, unggahan.
export async function GET(request: Request, { params }: RouteContext<"/api/files/[...path]">) {
  const { path } = await params;
  return serveFile(storageRoot(), path, request);
}
