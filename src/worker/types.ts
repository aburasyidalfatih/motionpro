import type { JobRun } from "@/generated/prisma/client";

export type JobContext = {
  run: JobRun;
  // Progress 0–100, ditulis ke JobRun agar tampil di UI.
  setProgress: (progress: number) => Promise<void>;
};

// Nilai yang dikembalikan handler disimpan di JobRun.result.
export type JobHandler = (ctx: JobContext) => Promise<object | void>;
