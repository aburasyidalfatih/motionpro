import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { RenderInternals } from "@remotion/renderer";
import { UnrecoverableError } from "bullmq";
import { scriptAI } from "@/lib/ai";
import type { ReviewFrame } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { asJson, toProjectBrief } from "@/lib/projects";
import type { ReviewJobInput } from "@/lib/queue";
import { storagePath } from "@/lib/storage";
import type { VideoReview } from "@/lib/video/review";
import { FPS, sceneTimings } from "@/remotion/history/timing";
import type { JobHandler } from "../types";

// Paling banyak sekian frame per video, dan per panggilan Gemini.
const MAX_FRAMES = 60;
const BATCH = 20;

// Satu frame JPEG dari video pada detik tertentu, lewat ffmpeg bawaan Remotion.
async function extractFrame(videoPath: string, seconds: number, output: string) {
  await RenderInternals.callFf({
    bin: "ffmpeg",
    args: [
      "-y",
      "-ss",
      seconds.toFixed(2),
      "-i",
      videoPath,
      "-frames:v",
      "1",
      "-vf",
      "scale=768:-2",
      "-q:v",
      "5",
      output,
    ],
    indent: false,
    logLevel: "error",
    binariesDirectory: null,
    cancelSignal: undefined,
  });
  return readFile(output);
}

// Pemeriksaan AI atas video hasil render: satu frame per adegan (pada 70%
// durasinya, saat elemen grafis sudah tampil) diperiksa Gemini vision untuk
// teks terpotong atau bertumpuk, layar kosong, salah ketik, dan visual yang tidak
// cocok dengan narasi. Waktu adegan dihitung dari naskah sekarang, jadi
// periksa sebelum mengubah naskah.
export const review: JobHandler = async ({ run, setProgress }) => {
  const input = (run.input ?? {}) as ReviewJobInput;
  const video = await db.video.findUnique({
    where: { id: input.videoId },
    include: { project: { include: { scenes: { orderBy: { order: "asc" } } } } },
  });
  if (!video) throw new UnrecoverableError("Video tidak ditemukan");
  const { project } = video;
  const scenes = project.scenes;
  const timings = sceneTimings({ scenes: scenes.map((s) => ({ durationMs: s.durationMs ?? 5000 })) });

  const step = Math.max(1, scenes.length / MAX_FRAMES);
  const picks = Array.from({ length: Math.min(scenes.length, MAX_FRAMES) }, (_, k) => Math.floor(k * step));
  const dir = await mkdtemp(path.join(tmpdir(), "motionpro-review-"));
  const frames: (ReviewFrame & { timeMs: number })[] = [];
  try {
    for (const [k, i] of picks.entries()) {
      const timeMs = ((timings[i].start + timings[i].frames * 0.7) / FPS) * 1000;
      if (timeMs >= video.durationMs) break;
      const image = await extractFrame(storagePath(video.storageKey), timeMs / 1000, path.join(dir, `${k}.jpg`));
      frames.push({ image, scene: i, visualType: scenes[i].visualType, narration: scenes[i].narration, timeMs });
      await setProgress(((k + 1) / picks.length) * 40);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  const issues: VideoReview["issues"] = [];
  for (let start = 0; start < frames.length; start += BATCH) {
    const batch = frames.slice(start, start + BATCH);
    const result = await scriptAI().reviewFrames(toProjectBrief(project), batch);
    for (const issue of result.issues) {
      const frame = batch[issue.frame];
      if (!frame) continue;
      issues.push({
        scene: frame.scene,
        timeMs: Math.round(frame.timeMs),
        severity: issue.severity,
        problem: issue.problem,
        fix: issue.fix,
      });
    }
    await setProgress(40 + ((start + batch.length) / frames.length) * 60);
  }

  const reviewResult: VideoReview = { checkedAt: new Date().toISOString(), issues };
  await db.video.update({ where: { id: video.id }, data: { review: asJson(reviewResult) } });
  return { frames: frames.length, issues: issues.length };
};
