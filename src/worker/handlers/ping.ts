import type { JobHandler } from "../types";

// Job uji Fase 0: membuktikan alur web → antrian → worker → database berjalan.
export const ping: JobHandler = async ({ setProgress }) => {
  const steps = 5;
  for (let i = 1; i <= steps; i++) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    await setProgress(Math.round((i / steps) * 100));
  }
  return { pong: true, at: new Date().toISOString() };
};
