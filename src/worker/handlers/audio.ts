import { unlink } from "node:fs/promises";
import { UnrecoverableError } from "bullmq";
import type { Scene } from "@/generated/prisma/client";
import { aiConcurrency } from "@/lib/ai";
import { mapLimit } from "@/lib/async";
import { db } from "@/lib/db";
import { listMusic, pickMusic } from "@/lib/library";
import { recomputeStatus } from "@/lib/project-status";
import type { AudioJobInput } from "@/lib/queue";
import { saveFile, storagePath } from "@/lib/storage";
import { DEFAULT_VOICE, DEFAULT_VOICE_STYLE, synthesize } from "@/lib/tts";
import { estimateWordTimings, pcmDurationMs, pcmToWav, speechBounds } from "@/lib/tts/audio";
import type { JobHandler } from "../types";

// Jeda setelah narasi sebelum adegan berikutnya.
const SCENE_PADDING_MS = 300;

async function voiceScene(scene: Scene, voice: string, style: string) {
  const speech = await synthesize(scene.narration, { voice, style });
  const durationMs = pcmDurationMs(speech.pcm, speech.sampleRate);
  const bounds = speechBounds(speech.pcm, speech.sampleRate);
  // Nama file memuat waktu agar browser tidak memutar versi lama dari cache.
  const audioPath = await saveFile(
    `projects/${scene.projectId}/audio/${scene.id}-${Date.now()}.wav`,
    pcmToWav(speech.pcm, speech.sampleRate),
  );

  const previous = await db.voiceover.findUnique({ where: { sceneId: scene.id } });
  const data = {
    audioPath,
    durationMs,
    voiceId: voice,
    wordTimestamps: estimateWordTimings(scene.narration, bounds.startMs, bounds.endMs),
  };
  await db.$transaction([
    db.voiceover.upsert({ where: { sceneId: scene.id }, create: { sceneId: scene.id, ...data }, update: data }),
    // F-19: durasi adegan mengikuti panjang audio.
    db.scene.update({ where: { id: scene.id }, data: { durationMs: durationMs + SCENE_PADDING_MS } }),
  ]);
  if (previous) await unlink(storagePath(previous.audioPath)).catch(() => {});
}

// F-19–F-22: voice over per adegan, waktu per kata untuk subtitle, dan musik latar.
export const audio: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job audio tanpa proyek");
  const project = await db.project.findUniqueOrThrow({ where: { id: run.projectId } });
  const voice = project.voiceId || DEFAULT_VOICE;
  const style = project.voiceStyle || DEFAULT_VOICE_STYLE;
  const input = (run.input ?? {}) as AudioJobInput;

  if (input.sceneId) {
    const scene = await db.scene.findUnique({ where: { id: input.sceneId } });
    if (!scene) throw new UnrecoverableError("Adegan tidak ditemukan");
    await voiceScene(scene, voice, style);
    await recomputeStatus(project.id);
    return { sceneId: scene.id };
  }

  const scenes = await db.scene.findMany({
    where: { projectId: project.id, ...(input.regenerate ? {} : { voiceover: { is: null } }) },
    orderBy: { order: "asc" },
  });
  let done = 0;
  await mapLimit(scenes, aiConcurrency(), async (scene) => {
    await voiceScene(scene, voice, style);
    done++;
    await setProgress((done / scenes.length) * 100);
  });

  // F-22: musik latar dipilih otomatis dari library bila belum ada.
  if (!project.musicTrack) {
    const all = await db.scene.findMany({ where: { projectId: project.id }, select: { mood: true } });
    const track = pickMusic(await listMusic(), all.map((s) => s.mood));
    if (track) await db.project.update({ where: { id: project.id }, data: { musicTrack: track.path } });
  }

  await recomputeStatus(project.id);
  return { scenes: scenes.length };
};
