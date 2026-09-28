"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasActiveStageJob } from "@/lib/project-jobs";
import { enqueueJob, type AudioJobInput } from "@/lib/queue";

// F-19: voice over untuk adegan yang belum punya, atau semua adegan (regenerate).
export async function startAudio(projectId: string, regenerate = false) {
  if (await hasActiveStageJob(projectId)) return;
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (project.status === "FAILED") {
    await db.project.update({ where: { id: projectId }, data: { status: "SCRIPT_READY", failedStage: null } });
  }
  const input: AudioJobInput = { regenerate };
  await enqueueJob("AUDIO", { projectId, input });
  redirect(`/projects/${projectId}/audio`);
}

// F-21: suara narator dan instruksi gaya bicara (tempo, nada) untuk Gemini TTS.
export async function saveVoiceSettings(projectId: string, formData: FormData) {
  const voiceId = String(formData.get("voiceId") ?? "").trim() || null;
  const voiceStyle = String(formData.get("voiceStyle") ?? "").trim() || null;
  await db.project.update({ where: { id: projectId }, data: { voiceId, voiceStyle } });
  refresh();
}

// Contoh suara narator untuk semua suara yang belum punya (tidak terikat proyek).
export async function startVoiceSamples() {
  const active = await db.jobRun.findFirst({
    where: { kind: "VOICE_SAMPLES", status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (!active) await enqueueJob("VOICE_SAMPLES");
  refresh();
}

// F-21: membuat ulang suara satu adegan.
export async function revoiceScene(sceneId: string) {
  const scene = await db.scene.findUniqueOrThrow({ where: { id: sceneId } });
  const input: AudioJobInput = { sceneId };
  await enqueueJob("AUDIO", { projectId: scene.projectId, input });
  refresh();
}

// F-22: musik latar dari library.
export async function saveMusic(projectId: string, formData: FormData) {
  const musicTrack = String(formData.get("musicTrack") ?? "") || null;
  await db.project.update({ where: { id: projectId }, data: { musicTrack } });
  refresh();
}
