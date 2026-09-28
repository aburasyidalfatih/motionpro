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

// Warna badge status proyek (lihat Badge di components/ui.tsx).
export const projectStatusTone: Record<
  ProjectStatus,
  "neutral" | "accent" | "info" | "success" | "warning" | "danger"
> = {
  DRAFT: "neutral",
  RESEARCH_READY: "info",
  SCRIPT_READY: "info",
  ASSETS_READY: "info",
  AUDIO_READY: "accent",
  RENDERING: "warning",
  RENDERED: "success",
  PUBLISHED: "success",
  FAILED: "danger",
};

export const jobKindLabel: Record<JobKind, string> = {
  PING: "Job uji",
  RESEARCH: "Riset",
  SCRIPT: "Naskah",
  ASSETS: "Aset",
  AUDIO: "Audio",
  RENDER: "Render",
  PUBLISH: "Publish",
  VOICE_SAMPLES: "Contoh suara",
};

export const visualTypeLabel: Record<string, string> = {
  title: "Kartu judul",
  kinetic_text: "Teks kinetik",
  map: "Peta",
  timeline: "Timeline",
  stat: "Statistik",
  comparison: "Perbandingan",
  quote: "Kutipan",
  painting: "Lukisan",
  archival_photo: "Foto arsip",
  footage: "Footage suasana",
};

export const styleOptions = [
  {
    value: "GRAPHIC",
    label: "Full grafis",
    description: "Peta, panah pasukan, statistik, perbandingan, timeline. Tanpa aset pihak ketiga.",
  },
  {
    value: "ARCHIVAL",
    label: "Arsip dan grafis",
    description: "Lukisan, foto arsip, dan footage dari Wikimedia/Pexels, dicampur adegan grafis.",
  },
] as const;

export const moodLabel: Record<string, string> = {
  epic: "Epik",
  tense: "Tegang",
  calm: "Tenang",
  somber: "Muram",
  hopeful: "Penuh harapan",
  mysterious: "Misterius",
};

export const toneOptions = [
  { value: "dokumenter", label: "Dokumenter (serius, sinematik)" },
  { value: "dramatis", label: "Dramatis (bercerita, penuh ketegangan)" },
  { value: "edukatif", label: "Edukatif (jelas, runtut)" },
  { value: "santai", label: "Santai (ringan, bersahabat)" },
];

export const jobStatusLabel: Record<JobStatus, string> = {
  QUEUED: "Dalam antrian",
  RUNNING: "Berjalan",
  SUCCEEDED: "Sukses",
  FAILED: "Gagal",
};
