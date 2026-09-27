"use server";

import { refresh } from "next/cache";
import { enqueueJob } from "@/lib/queue";

export type TestJobState = { error?: string };

export async function runTestJob(): Promise<TestJobState> {
  try {
    await enqueueJob("PING");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: `Gagal memasukkan job ke antrian: ${message}` };
  }
  refresh();
  return {};
}
