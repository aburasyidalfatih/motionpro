import "dotenv/config";
import { UnrecoverableError, Worker } from "bullmq";
import type { JobKind } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import {
  createRedis,
  PIPELINE_QUEUE,
  WORKER_HEARTBEAT_KEY,
  WORKER_HEARTBEAT_TTL_SECONDS,
  type PipelineJobData,
} from "@/lib/queue";
import { ping } from "./handlers/ping";
import type { JobHandler } from "./types";

// Handler per jenis job. Tahap lain (riset, naskah, aset, audio, render,
// publish) ditambahkan di fase masing-masing.
const handlers: Partial<Record<JobKind, JobHandler>> = {
  PING: ping,
};

// Render memakan hampir seluruh CPU, jadi default-nya satu job sekaligus.
const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 1);

const connection = createRedis();

const worker = new Worker<PipelineJobData>(
  PIPELINE_QUEUE,
  async (job) => {
    const run = await db.jobRun.findUnique({ where: { id: job.data.jobRunId } });
    if (!run) throw new UnrecoverableError(`JobRun ${job.data.jobRunId} tidak ditemukan`);

    const handler = handlers[run.kind];
    if (!handler) throw new UnrecoverableError(`Belum ada handler untuk job ${run.kind}`);

    await db.jobRun.update({
      where: { id: run.id },
      data: { status: "RUNNING", startedAt: new Date(), error: null },
    });

    const setProgress = async (progress: number) => {
      const value = Math.max(0, Math.min(100, Math.round(progress)));
      await Promise.all([
        db.jobRun.update({ where: { id: run.id }, data: { progress: value } }),
        job.updateProgress(value),
      ]);
    };

    const result = await handler({ run, setProgress });

    await db.jobRun.update({
      where: { id: run.id },
      data: {
        status: "SUCCEEDED",
        progress: 100,
        result: result ?? undefined,
        finishedAt: new Date(),
      },
    });
  },
  { connection, concurrency },
);

worker.on("failed", async (job, err) => {
  if (!job) return;
  const attemptsLeft = (job.opts.attempts ?? 1) - job.attemptsMade;
  const final = attemptsLeft <= 0 || err instanceof UnrecoverableError;
  await db.jobRun
    .update({
      where: { id: job.data.jobRunId },
      data: final
        ? { status: "FAILED", error: err.message, finishedAt: new Date() }
        : { status: "QUEUED", error: `${err.message} (dicoba lagi)` },
    })
    .catch(() => {});
  console.error(`[worker] job ${job.name} ${job.id} gagal: ${err.message}`);
});

worker.on("completed", (job) => {
  console.log(`[worker] job ${job.name} ${job.id} selesai`);
});

// Heartbeat agar halaman Sistem bisa menampilkan status worker.
const heartbeat = setInterval(() => {
  connection
    .set(WORKER_HEARTBEAT_KEY, new Date().toISOString(), "EX", WORKER_HEARTBEAT_TTL_SECONDS)
    .catch((err) => console.error("[worker] heartbeat gagal:", err.message));
}, 5_000);

console.log(`[worker] berjalan, antrian "${PIPELINE_QUEUE}", concurrency ${concurrency}`);

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} diterima, menunggu job aktif selesai...`);
  clearInterval(heartbeat);
  await worker.close();
  await connection.del(WORKER_HEARTBEAT_KEY).catch(() => {});
  connection.disconnect();
  await db.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
