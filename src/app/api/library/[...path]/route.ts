import { libraryRoot } from "@/lib/library";
import { serveFile } from "@/lib/serve-file";

// File di folder library: musik latar dan efek suara.
export async function GET(request: Request, { params }: RouteContext<"/api/library/[...path]">) {
  const { path } = await params;
  return serveFile(libraryRoot(), path, request);
}
