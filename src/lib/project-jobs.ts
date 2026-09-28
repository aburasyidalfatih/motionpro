import { unlink } from "node:fs/promises";
import { db } from "@/lib/db";
import { isSceneJob } from "@/lib/queue";
import { storagePath } from "@/lib/storage";

// Job tahap (riset, naskah, aset, audio penuh) yang sedang berjalan.
// Job untuk satu adegan tidak dihitung, jadi tidak mengunci halaman.
export async function hasActiveStageJob(projectId: string) {
  const active = await db.jobRun.findMany({
    where: { projectId, status: { in: ["QUEUED", "RUNNING"] } },
    select: { input: true },
  });
  return active.some((job) => !isSceneJob(job.input));
}

// Voice over yang tidak cocok lagi dengan narasinya dihapus beserta filenya.
export async function deleteVoiceover(sceneId: string) {
  const voiceover = await db.voiceover.findUnique({ where: { sceneId } });
  if (!voiceover) return;
  await db.voiceover.delete({ where: { sceneId } });
  await unlink(storagePath(voiceover.audioPath)).catch(() => {});
}
