"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { moods, visualTypes } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { deleteVoiceover, hasActiveStageJob as hasActiveJob } from "@/lib/project-jobs";
import { recomputeStatus } from "@/lib/project-status";
import { estimateDurationMs, hasReached } from "@/lib/projects";
import { enqueueJob, type ScriptJobInput } from "@/lib/queue";
import { startAssets } from "./storyboard/actions";
import { startAudio } from "./audio/actions";

// Riset (ulang). Brief lama diganti saat riset selesai.
export async function startResearch(projectId: string) {
  if (await hasActiveJob(projectId)) return;
  await db.project.update({ where: { id: projectId }, data: { status: "DRAFT", failedStage: null } });
  await enqueueJob("RESEARCH", { projectId });
  redirect(`/projects/${projectId}/research`);
}

// Menulis (ulang) seluruh naskah dari brief. Adegan lama diganti saat selesai.
export async function startScript(projectId: string) {
  if (await hasActiveJob(projectId)) return;
  const brief = await db.researchBrief.findUnique({ where: { projectId } });
  if (!brief?.markdown.trim()) return;
  await db.project.update({ where: { id: projectId }, data: { status: "RESEARCH_READY", failedStage: null } });
  await enqueueJob("SCRIPT", { projectId });
  redirect(`/projects/${projectId}/script`);
}

export async function retryFailedStage(projectId: string) {
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (project.failedStage === "RESEARCH") return startResearch(projectId);
  if (project.failedStage === "SCRIPT") return startScript(projectId);
  if (project.failedStage === "ASSETS") return startAssets(projectId);
  if (project.failedStage === "AUDIO") return startAudio(projectId);
}

// F-07: brief yang diedit menjadi dasar naskah. Mengedit brief setelah naskah
// ditulis mengembalikan status ke tahap riset (PRD: status proyek).
export async function saveBrief(projectId: string, formData: FormData) {
  const markdown = String(formData.get("markdown") ?? "");
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  await db.$transaction([
    db.researchBrief.update({ where: { projectId }, data: { markdown } }),
    ...(hasReached(project.status, "SCRIPT_READY")
      ? [db.project.update({ where: { id: projectId }, data: { status: "RESEARCH_READY" } })]
      : []),
  ]);
  refresh();
}

const sceneForm = z.object({
  narration: z.string().trim().min(1),
  onScreenText: z.string().trim(),
  keywords: z.string(),
  visualType: z.enum(visualTypes),
  mood: z.enum(moods),
});

// F-10: editor adegan.
export async function saveScene(sceneId: string, formData: FormData) {
  const parsed = sceneForm.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const { narration, onScreenText, keywords, visualType, mood } = parsed.data;
  const before = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const narrationChanged = before.narration !== narration;
  await db.scene.update({
    where: { id: sceneId },
    data: {
      narration,
      onScreenText: onScreenText || null,
      keywords: keywords
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean),
      visualType,
      mood,
      // Durasi dari voice over tetap dipakai selama narasinya tidak berubah.
      ...(narrationChanged ? { durationMs: estimateDurationMs(narration) } : {}),
    },
  });
  if (narrationChanged) {
    await deleteVoiceover(sceneId);
    await recomputeStatus(before.projectId);
  }
  refresh();
}

// Menulis ulang urutan adegan menjadi 0, 1, 2, ... sesuai urutan id.
async function renumber(ids: string[]) {
  await db.$transaction(ids.map((id, order) => db.scene.update({ where: { id }, data: { order } })));
}

async function orderedSceneIds(projectId: string) {
  const scenes = await db.scene.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    select: { id: true },
  });
  return scenes.map((s) => s.id);
}

export async function moveScene(sceneId: string, direction: "up" | "down") {
  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const ids = await orderedSceneIds(scene.projectId);
  const from = ids.indexOf(sceneId);
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to], ids[from]];
  await renumber(ids);
  refresh();
}

export async function deleteScene(sceneId: string) {
  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  await deleteVoiceover(sceneId);
  await db.scene.delete({ where: { id: sceneId } });
  await renumber(await orderedSceneIds(scene.projectId));
  await recomputeStatus(scene.projectId);
  refresh();
}

export async function addSceneAfter(sceneId: string) {
  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const created = await db.scene.create({
    data: {
      projectId: scene.projectId,
      order: scene.order,
      narration: "Narasi adegan baru.",
      keywords: [],
      visualType: "painting",
      mood: scene.mood,
      durationMs: estimateDurationMs("Narasi adegan baru."),
    },
  });
  const ids = (await orderedSceneIds(scene.projectId)).filter((id) => id !== created.id);
  ids.splice(ids.indexOf(sceneId) + 1, 0, created.id);
  await renumber(ids);
  await recomputeStatus(scene.projectId);
  refresh();
}

export async function rewriteScene(sceneId: string, formData: FormData) {
  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  if (await hasActiveJob(scene.projectId)) return;
  const input: ScriptJobInput = {
    sceneId,
    instruction: String(formData.get("instruction") ?? "").trim(),
  };
  await enqueueJob("SCRIPT", { projectId: scene.projectId, input });
  refresh();
}
