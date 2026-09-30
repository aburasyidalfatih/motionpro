import { stat } from "node:fs/promises";
import path from "node:path";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";
import { UnrecoverableError } from "bullmq";
import { needsAsset } from "@/lib/ai/schemas";
import { ensureLocal } from "@/lib/assets/download";
import { db } from "@/lib/db";
import { saveFile, storagePath } from "@/lib/storage";
import { buildChapters } from "@/lib/video/chapters";
import { masterLoudness } from "@/lib/video/master";
import { buildVideoProps, projectVideoInclude } from "@/lib/video/props";
import { buildThumbnailProps } from "@/lib/video/thumbnail";
import { buildSrt } from "@/lib/video/srt";
import { startStaticServer } from "@/lib/video/static-server";
import type { RenderJobInput } from "@/lib/queue";
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

const GL_RENDERERS = ["angle", "swangle", "egl", "swiftshader", "vulkan", "angle-egl"] as const;
type GlRenderer = (typeof GL_RENDERERS)[number];

// Butiran film dan light leak memakai WebGL2. Bawaan Chrome sudah cukup di
// kebanyakan komputer; REMOTION_GL mengganti renderer bila WebGL gagal.
const glRenderer = (): GlRenderer | null => GL_RENDERERS.find((gl) => gl === process.env.REMOTION_GL) ?? null;

const renderOptions = () => ({
  browserExecutable: process.env.REMOTION_BROWSER_EXECUTABLE || null,
  concurrency: process.env.RENDER_CONCURRENCY || null,
  timeoutInMilliseconds: 120_000,
  chromiumOptions: { gl: glRenderer() },
});

// Skala render terhadap komposisi 1920×1080: tata letak sama, piksel lebih banyak.
const RESOLUTION_SCALE = { "1080p": 1, "1440p": 4 / 3 } as const;

// F-27, F-28: render video 1080p/1440p 30 fps (H.264, AAC), mastering audio,
// gambar mini, file SRT, dan chapter YouTube.
export const render: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job render tanpa proyek");
  const input = (run.input ?? {}) as RenderJobInput;
  const project = await db.project.findUniqueOrThrow({ where: { id: run.projectId }, include: projectVideoInclude });

  const missing = project.scenes.filter((s) => !s.voiceover || (needsAsset(s.visualType) && !s.assets[0])).length;
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
    const inputProps = await buildVideoProps(project, server.urls, {
      subtitles: input.subtitles ?? true,
      endScreen: input.endScreen ?? false,
      // Motion blur menambah waktu render sekitar 20–40%; RENDER_MOTION_BLUR=off mematikannya.
      motionBlur: process.env.RENDER_MOTION_BLUR !== "off",
      finishing: process.env.RENDER_FINISHING !== "off",
    });
    const serveUrl = await getBundle();
    await setProgress(5);

    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, ...renderOptions() });
    const base = `videos/${project.id}/${run.id}`;
    const videoPath = storagePath(`${base}.mp4`);
    const scale = RESOLUTION_SCALE[input.resolution ?? "1080p"];

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
      scale,
      onProgress: ({ progress }) => {
        const percent = Math.floor(5 + progress * 88);
        if (percent !== lastPercent) {
          lastPercent = percent;
          void setProgress(percent);
        }
      },
    });

    // Mastering audio ke -14 LUFS (standar YouTube); RENDER_MASTERING=off melewatinya.
    if (process.env.RENDER_MASTERING !== "off") await masterLoudness(videoPath);
    await setProgress(95);

    // Thumbnail YouTube 1280×720: teks besar di atas adegan paling visual (Thumbnail.tsx).
    const thumbProps = buildThumbnailProps(inputProps, project);
    const thumbComposition = await selectComposition({
      serveUrl,
      id: "Thumbnail",
      inputProps: thumbProps,
      ...renderOptions(),
    });
    await renderStill({
      ...renderOptions(),
      serveUrl,
      composition: thumbComposition,
      inputProps: thumbProps,
      frame: thumbComposition.durationInFrames - 1,
      output: storagePath(`${base}.jpg`),
      imageFormat: "jpeg",
      jpegQuality: 90,
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
        chapters: buildChapters(inputProps, composition.fps),
        durationMs: Math.round((composition.durationInFrames / composition.fps) * 1000),
        sizeBytes: BigInt(size),
        width: Math.round(composition.width * scale),
        height: Math.round(composition.height * scale),
        fps: composition.fps,
      },
    });
    await db.project.update({ where: { id: project.id }, data: { status: "RENDERED", failedStage: null } });
    return { videoId: video.id, sizeBytes: size };
  } finally {
    await server.close();
  }
};
