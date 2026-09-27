import { db } from "@/lib/db";
import { redis, WORKER_HEARTBEAT_KEY } from "@/lib/queue";

export type Check = {
  ok: boolean;
  detail: string;
};

export type Health = {
  database: Check;
  redis: Check;
  worker: Check;
};

const TIMEOUT_MS = 2_000;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`tidak merespons dalam ${TIMEOUT_MS / 1000} detik`)), TIMEOUT_MS),
    ),
  ]);
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

async function checkDatabase(): Promise<Check> {
  try {
    await withTimeout(db.$queryRaw`SELECT 1`);
    return { ok: true, detail: "Terhubung" };
  } catch (err) {
    return { ok: false, detail: errorMessage(err) };
  }
}

async function checkRedis(): Promise<Check> {
  try {
    await withTimeout(redis().ping());
    return { ok: true, detail: "Terhubung" };
  } catch (err) {
    return { ok: false, detail: errorMessage(err) };
  }
}

async function checkWorker(): Promise<Check> {
  try {
    const beat = await withTimeout(redis().get(WORKER_HEARTBEAT_KEY));
    if (!beat) return { ok: false, detail: "Tidak berjalan (jalankan npm run worker)" };
    const seconds = Math.round((Date.now() - new Date(beat).getTime()) / 1000);
    return { ok: true, detail: `Aktif, heartbeat ${seconds} detik lalu` };
  } catch (err) {
    return { ok: false, detail: `Tidak diketahui: ${errorMessage(err)}` };
  }
}

export async function getHealth(): Promise<Health> {
  const [database, redisCheck, worker] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkWorker(),
  ]);
  return { database, redis: redisCheck, worker };
}
