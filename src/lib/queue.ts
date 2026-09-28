import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { JobKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

// Semua tahap pipeline memakai satu antrian; jenis job dibedakan lewat nama job
// (JobKind). Worker render nanti bisa dipisah ke antrian sendiri bila perlu.
export const PIPELINE_QUEUE = "pipeline";

// Worker menulis kunci ini secara berkala agar UI tahu worker sedang hidup.
export const WORKER_HEARTBEAT_KEY = "motionpro:worker:heartbeat";
export const WORKER_HEARTBEAT_TTL_SECONDS = 15;

export type PipelineJobData = {
  jobRunId: string;
};

// Input job SCRIPT: dengan sceneId hanya satu adegan yang ditulis ulang;
// dengan geocode hanya koordinat peta yang diperiksa ulang; selain itu
// seluruh naskah ditulis dari research brief.
export type ScriptJobInput = {
  sceneId?: string;
  instruction?: string;
  geocode?: boolean;
};

// Input job ASSETS: tanpa sceneId, cari aset untuk adegan yang belum punya
// kandidat (atau semua adegan bila all); dengan sceneId, cari ulang (query)
// atau unduh aset terpilih (downloadOnly).
export type AssetJobInput = {
  sceneId?: string;
  query?: string;
  downloadOnly?: boolean;
  all?: boolean;
};

// Input job AUDIO: tanpa sceneId, buat voice over untuk adegan yang belum
// punya (atau semua bila regenerate, atau yang suara/gayanya berbeda dari
// pengaturan proyek bila outdated); dengan sceneId, satu adegan saja.
export type AudioJobInput = {
  sceneId?: string;
  regenerate?: boolean;
  outdated?: boolean;
};

// Input job VOICE_SAMPLES (tanpa proyek): contoh suara narator untuk halaman
// Audio. Tanpa voices, dibuat untuk semua suara yang belum punya contoh.
export type VoiceSamplesJobInput = {
  voices?: string[];
};

// Input job RENDER.
export type RenderJobInput = {
  subtitles?: boolean;
};

// Job untuk satu adegan tidak menandai proyek gagal dan tidak mengunci halaman.
export function isSceneJob(input: unknown) {
  return Boolean((input as { sceneId?: string } | null)?.sceneId);
}

// Koneksi worker wajib memakai maxRetriesPerRequest: null (syarat BullMQ).
// Koneksi web memakai batas retry agar request gagal cepat saat Redis mati,
// bukan menggantung.
export function createRedis(role: "worker" | "web" = "worker") {
  return new Redis(env().REDIS_URL, {
    maxRetriesPerRequest: role === "worker" ? null : 1,
  });
}

const globalForQueue = globalThis as unknown as {
  pipelineQueue?: Queue<PipelineJobData>;
  redis?: Redis;
};

export function redis(): Redis {
  globalForQueue.redis ??= createRedis("web");
  return globalForQueue.redis;
}

export function pipelineQueue(): Queue<PipelineJobData> {
  globalForQueue.pipelineQueue ??= new Queue<PipelineJobData>(PIPELINE_QUEUE, {
    connection: redis(),
  });
  return globalForQueue.pipelineQueue;
}

// Mencatat job di database lalu memasukkannya ke antrian. Baris JobRun adalah
// sumber status dan progress yang dibaca UI.
export async function enqueueJob(
  kind: JobKind,
  options: { projectId?: string; input?: object } = {},
) {
  const run = await db.jobRun.create({
    data: { kind, projectId: options.projectId, input: options.input },
  });
  await pipelineQueue().add(
    kind,
    { jobRunId: run.id },
    {
      jobId: run.id,
      attempts: 3,
      backoff: { type: "exponential", delay: 5_000 },
      removeOnComplete: 1_000,
      removeOnFail: 1_000,
    },
  );
  return run;
}
