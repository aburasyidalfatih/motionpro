"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hasActiveStageJob } from "@/lib/project-jobs";
import { enqueueJob, type AudioJobInput } from "@/lib/queue";
import { findSceneOrRefresh } from "@/lib/scenes";

// F-19: voice over untuk adegan yang belum punya ("missing"), semua adegan
// ("all"), atau adegan yang suara/gayanya berbeda dari pengaturan proyek
// ("outdated"), atau hanya menghitung ulang waktu per kata ("realign"). Semua argumen diikat lewat bind, jadi FormData dari form
// masuk sebagai argumen ketiga dan diabaikan.
export async function startAudio(projectId: string, mode: "missing" | "all" | "outdated" | "realign" = "missing") {
  if (await hasActiveStageJob(projectId)) return;
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (project.status === "FAILED") {
    await db.project.update({ where: { id: projectId }, data: { status: "SCRIPT_READY", failedStage: null } });
  }
  const input: AudioJobInput = {
    regenerate: mode === "all",
    outdated: mode === "outdated",
    realign: mode === "realign",
  };
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
  const scene = await findSceneOrRefresh(sceneId);
  if (!scene) return;
  const input: AudioJobInput = { sceneId };
  await enqueueJob("AUDIO", { projectId: scene.projectId, input });
  refresh();
}

// F-22: musik latar dari library.
export async function saveMusic(projectId: string, formData: FormData) {
  const musicTrack = String(formData.get("musicTrack") ?? "") || null;
  const musicPerChapter = formData.get("musicPerChapter") === "on";
  await db.project.update({ where: { id: projectId }, data: { musicTrack, musicPerChapter } });
  refresh();
}
