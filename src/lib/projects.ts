import type { Prisma, ProjectStatus } from "@/generated/prisma/client";
import { WORDS_PER_MINUTE } from "@/lib/ai/prompts";
import type { ProjectBrief } from "@/lib/ai/types";
import type { Brief } from "@/lib/ai/schemas";

// Urutan tahap proyek; dipakai untuk mengetahui apakah suatu tahap sudah dilewati.
const STAGE_ORDER: ProjectStatus[] = [
  "DRAFT",
  "RESEARCH_READY",
  "SCRIPT_READY",
  "ASSETS_READY",
  "AUDIO_READY",
  "RENDERING",
  "RENDERED",
  "PUBLISHED",
];

export function hasReached(status: ProjectStatus, stage: ProjectStatus) {
  return STAGE_ORDER.indexOf(status) >= STAGE_ORDER.indexOf(stage);
}

export function toProjectBrief(project: {
  topic: string;
  language: string;
  tone: string;
  targetMinutes: number;
}): ProjectBrief {
  return {
    topic: project.topic,
    language: project.language,
    tone: project.tone,
    targetMinutes: project.targetMinutes,
  };
}

export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Perkiraan durasi narasi sebelum ada audio TTS (Fase 2).
export function estimateDurationMs(narration: string) {
  return Math.round((countWords(narration) / WORDS_PER_MINUTE) * 60_000);
}

export function formatDuration(ms: number) {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

// Brief terstruktur dari Gemini diubah menjadi markdown yang bisa diedit pengguna.
// Naskah ditulis dari markdown ini, jadi suntingan pengguna ikut terpakai.
export function briefToMarkdown(brief: Brief) {
  const cite = (sources: number[]) => (sources.length ? " " + sources.map((n) => `[${n}]`).join("") : "");
  const sections = [
    `## Ringkasan\n\n${brief.summary}`,
    `## Fakta kunci\n\n${brief.facts.map((f) => `- ${f.text}${cite(f.sources)}`).join("\n")}`,
  ];
  if (brief.timeline.length) {
    sections.push(`## Timeline\n\n${brief.timeline.map((t) => `- **${t.date}**: ${t.event}`).join("\n")}`);
  }
  sections.push(`## Calon hook\n\n${brief.hooks.map((h) => `- ${h}`).join("\n")}`);
  if (brief.angles.length) {
    sections.push(`## Sudut cerita\n\n${brief.angles.map((a) => `- ${a}`).join("\n")}`);
  }
  return sections.join("\n\n");
}

export function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
