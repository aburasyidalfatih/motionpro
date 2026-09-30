import { randomUUID } from "node:crypto";
import path from "node:path";
import { processImage } from "@/lib/assets/download";
import { db } from "@/lib/db";
import { recomputeStatus } from "@/lib/project-status";
import { enqueueJob, type AssetJobInput } from "@/lib/queue";
import { saveFile } from "@/lib/storage";

const MAX_BYTES = 500 * 1024 * 1024;

// F-15: mengunggah aset sendiri untuk satu adegan. Memakai route handler, bukan
// server action, karena server action membatasi ukuran body.
export async function POST(request: Request, { params }: RouteContext<"/api/scenes/[sceneId]/upload">) {
  const { sceneId } = await params;
  const scene = await db.scene.findUnique({ where: { id: sceneId } });
  if (!scene) return new Response("Adegan tidak ditemukan", { status: 404 });
  const back = new URL(`/projects/${scene.projectId}/storyboard#adegan-${scene.order + 1}`, request.url);

  const file = (await request.formData()).get("file");
  if (!(file instanceof File) || file.size === 0) return Response.redirect(back, 303);
  if (file.size > MAX_BYTES) return new Response("File terlalu besar (maksimal 500 MB)", { status: 413 });

  const isVideo = file.type === "video/mp4";
  if (!isVideo && !file.type.startsWith("image/")) {
    return new Response("Hanya gambar atau video MP4", { status: 415 });
  }

  const id = randomUUID();
  const raw = Buffer.from(await file.arrayBuffer());
  let localPath: string;
  let size: { width: number | null; height: number | null } = { width: null, height: null };
  if (isVideo) {
    localPath = await saveFile(`uploads/${id}.mp4`, raw);
  } else {
    const image = await processImage(raw);
    localPath = await saveFile(`uploads/${id}.jpg`, image.data);
    size = { width: image.width, height: image.height };
  }

  const asset = await db.asset.create({
    data: {
      kind: isVideo ? "VIDEO" : "IMAGE",
      provider: "upload",
      providerId: id,
      title: path.parse(file.name).name,
      localPath,
      license: "Milik pengguna",
      ...size,
    },
  });
  await db.$transaction([
    db.sceneAsset.updateMany({ where: { sceneId }, data: { selected: false } }),
    db.sceneAsset.create({ data: { sceneId, assetId: asset.id, rank: -1, selected: true } }),
  ]);
  await recomputeStatus(scene.projectId);
  // Gambar unggahan juga dianalisis worker untuk fokus kamera dan sorotan.
  if (!isVideo) {
    const input: AssetJobInput = { sceneId, downloadOnly: true };
    await enqueueJob("ASSETS", { projectId: scene.projectId, input });
  }
  return Response.redirect(back, 303);
}
