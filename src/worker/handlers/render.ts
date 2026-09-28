import { stat } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { UnrecoverableError } from "bullmq";
import { ensureLocal } from "@/lib/assets/download";
import { db } from "@/lib/db";
import { saveFile, storagePath } from "@/lib/storage";
import { buildVideoProps, projectVideoInclude } from "@/lib/video/props";
import { buildSrt } from "@/lib/video/srt";
import { startStaticServer } from "@/lib/video/static-server";
import type { RenderJobInput } from "@/lib/queue";
import { sceneTimings } from "@/remotion/history/timing";
import type { JobHandler } from "../types";

const COMPOSITION_ID = "HistoryVideo";

// Bundle Remotion dibuat sekali per proses worker (worker di-restart saat kode berubah).
let bundlePromise: Promise<string> | undefined;
function getBundle() {
  bundlePromise ??= bundle({ entryPoint: path.resolve("src/remotion/index.ts") }).catch((err) => {
    bundlePromise = undefined;
    throw err;
  });
  return bundlePromise;
}

const renderOptions = () => ({
  browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || null,
  concurrency: process.env.RENDER_CONCURRENCY || null,
  timeoutInMilliseconds: 120_000,
});

// F-27, F-28: render video 1080p 30 fps (H.264, AAC), gambar mini, dan file SRT.
export const render: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job render tanpa proyek");
  const input = (run.input ?? {}) as RenderJobInput;
  const project = await db.project.findUniqueOrThrow({ where: { id: run.projectId }, include: projectVideoInclude });

  const missing = project.scenes.filter((s) => !s.voiceover || (!s.assets[0] && !s.mapData)).length;
  if (project.scenes.length === 0 || missing > 0) {
    throw new UnrecoverableError(`${missing} adegan belum punya aset atau voice over`);
  }
  // Aset terpilih yang belum terunduh (misalnya dipilih manual) diunduh dulu.
  for (const scene of project.scenes) {
    const link = scene.assets[0];
    if (link && !link.asset.localPath) link.asset = await ensureLocal(link.asset);
  }
  await setProgress(2);

  const server = await startStaticServer();
  try {
    const inputProps = await buildVideoProps(project, server.urls, { subtitles: input.subtitles ?? true });
    const serveUrl = await getBundle();
    await setProgress(5);

    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, ...renderOptions() });
    const base = `videos/${project.id}/${run.id}`;
    const videoPath = storagePath(`${base}.mp4`);

    let lastPercent = -1;
    await renderMedia({
      ...renderOptions(),
      serveUrl,
      composition,
      inputProps,
      codec: "h264",
      outputLocation: videoPath,
      crf: 18,
      pixelFormat: "yuv420p",
      colorSpace: "bt709",
      audioCodec: "aac",
      audioBitrate: "320k",
      onProgress: ({ progress }) => {
        const percent = Math.floor(5 + progress * 90);
        if (percent !== lastPercent) {
          lastPercent = percent;
          void setProgress(percent);
        }
      },
    });

    // Gambar mini dari tengah adegan pertama yang bukan kartu judul, atau adegan pertama.
    const timings = sceneTimings(inputProps);
    const thumbScene = Math.max(
      0,
      inputProps.scenes.findIndex((s) => s.visualType !== "title"),
    );
    const thumbFrame = timings[thumbScene] ? timings[thumbScene].start + Math.floor(timings[thumbScene].frames / 2) : 0;
    await renderStill({
      ...renderOptions(),
      serveUrl,
      composition,
      inputProps: { ...inputProps, subtitles: false },
      frame: thumbFrame,
      output: storagePath(`${base}.jpg`),
      imageFormat: "jpeg",
      jpegQuality: 85,
      scale: 2 / 3,
    });
    await saveFile(`${base}.srt`, Buffer.from(buildSrt(inputProps, composition.fps)));
    await setProgress(98);

    const { size } = await stat(videoPath);
    const video = await db.video.create({
      data: {
        projectId: project.id,
        jobRunId: run.id,
        storageKey: `${base}.mp4`,
        thumbnailKey: `${base}.jpg`,
        srtKey: `${base}.srt`,
        durationMs: Math.round((composition.durationInFrames / composition.fps) * 1000),
        sizeBytes: BigInt(size),
        width: composition.width,
        height: composition.height,
        fps: composition.fps,
      },
    });
    await db.project.update({ where: { id: project.id }, data: { status: "RENDERED", failedStage: null } });
    return { videoId: video.id, sizeBytes: size };
  } finally {
    await server.close();
  }
};
