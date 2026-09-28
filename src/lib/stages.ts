import type { JobKind, ProjectStatus } from "@/generated/prisma/client";
import { hasReached } from "@/lib/projects";

// Lima tahap produksi video, urut seperti tab di halaman proyek.
export const STAGES = [
  { slug: "research", label: "Riset", reached: "RESEARCH_READY", job: "RESEARCH" },
  { slug: "script", label: "Naskah", reached: "SCRIPT_READY", job: "SCRIPT" },
  { slug: "storyboard", label: "Storyboard", reached: "ASSETS_READY", job: "ASSETS" },
  { slug: "audio", label: "Audio", reached: "AUDIO_READY", job: "AUDIO" },
  { slug: "render", label: "Render", reached: "RENDERED", job: "RENDER" },
] as const satisfies readonly { slug: string; label: string; reached: ProjectStatus; job: JobKind }[];

// Tahap mana saja yang sudah selesai. Proyek gagal dianggap sudah melewati
// tahap-tahap sebelum tahap yang gagal.
export function completedStages(status: ProjectStatus, failedStage: JobKind | null) {
  if (status === "FAILED") {
    const failed = STAGES.findIndex((s) => s.job === failedStage);
    return STAGES.map((_, i) => failed > i);
  }
  return STAGES.map((stage) => hasReached(status, stage.reached));
}
