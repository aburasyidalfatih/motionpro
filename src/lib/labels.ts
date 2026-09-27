import type { JobKind, JobStatus, ProjectStatus } from "@/generated/prisma/client";

export const projectStatusLabel: Record<ProjectStatus, string> = {
  DRAFT: "Draf",
  RESEARCH_READY: "Riset siap",
  SCRIPT_READY: "Naskah siap",
  ASSETS_READY: "Aset siap",
  AUDIO_READY: "Audio siap",
  RENDERING: "Merender",
  RENDERED: "Selesai dirender",
  PUBLISHED: "Terbit",
  FAILED: "Gagal",
};

export const jobKindLabel: Record<JobKind, string> = {
  PING: "Job uji",
  RESEARCH: "Riset",
  SCRIPT: "Naskah",
  ASSETS: "Aset",
  AUDIO: "Audio",
  RENDER: "Render",
  PUBLISH: "Publish",
};

export const jobStatusLabel: Record<JobStatus, string> = {
  QUEUED: "Dalam antrian",
  RUNNING: "Berjalan",
  SUCCEEDED: "Sukses",
  FAILED: "Gagal",
};
