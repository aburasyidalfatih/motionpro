"use server";

import { unlink } from "node:fs/promises";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasActiveStageJob } from "@/lib/project-jobs";
import { enqueueJob, type RenderJobInput } from "@/lib/queue";
import { storagePath } from "@/lib/storage";

const RENDERABLE = ["AUDIO_READY", "RENDERED"];

// F-27: memasukkan render ke antrian. Subtitle ditanam di video bila dicentang.
export async function startRender(projectId: string, formData?: FormData) {
  if (await hasActiveStageJob(projectId)) return;
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  const retrying = project.status === "FAILED" && project.failedStage === "RENDER";
  if (!RENDERABLE.includes(project.status) && !retrying) return;

  const input: RenderJobInput = {
    subtitles: formData ? formData.get("subtitles") === "on" : true,
    resolution: formData?.get("resolution") === "1440p" ? "1440p" : "1080p",
  };
  await db.project.update({ where: { id: projectId }, data: { status: "RENDERING", failedStage: null } });
  await enqueueJob("RENDER", { projectId, input });
  redirect(`/projects/${projectId}/render`);
}

// F-32: menghapus video beserta gambar mini dan SRT-nya.
export async function deleteVideo(videoId: string) {
  const video = await db.video.findUnique({ where: { id: videoId } });
  if (!video) return;
  await db.video.delete({ where: { id: videoId } });
  for (const key of [video.storageKey, video.thumbnailKey, video.srtKey]) {
    if (key) await unlink(storagePath(key)).catch(() => {});
  }
  refresh();
}
