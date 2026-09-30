import type { ScriptPart } from "./prompts";
import type { AssetRanking, Brief, ChapterReview, FrameReview, Outline, ResearchPlan, SceneDraft } from "./schemas";

// Satu frame video hasil render untuk diperiksa AI.
export type ReviewFrame = { image: Buffer; scene: number; visualType: string; narration: string };

export type ProjectBrief = {
  topic: string;
  // GRAPHIC: semua adegan grafis; ARCHIVAL: lukisan, arsip, footage, dan grafis.
  style: "GRAPHIC" | "ARCHIVAL";
  language: string;
  tone: string;
  targetMinutes: number;
};

export type SourceRef = { title: string; url: string };

export type ResearchNote = {
  question: string;
  text: string;
  sources: SourceRef[];
  // HTML Google Search Suggestions dari respons grounding.
  suggestionHtml?: string;
};

export type NumberedSource = SourceRef & { position: number };

// Satu adegan beserta kandidat asetnya untuk dinilai relevansinya (F-14).
export type RankingScene = {
  narration: string;
  visualType: string;
  candidates: { title: string; provider: string; kind: string }[];
};

export type ChapterInput = {
  project: ProjectBrief;
  briefMarkdown: string;
  outline: Outline;
  part: ScriptPart;
};

// Semua panggilan AI teks: riset, naskah, dan pemilihan aset. Implementasinya
// Gemini (produksi) atau tiruan (uji tanpa API key, AI_PROVIDER=fake).
export interface ScriptAI {
  planResearch(project: ProjectBrief): Promise<ResearchPlan>;
  research(project: ProjectBrief, question: string): Promise<ResearchNote>;
  // Putaran kedua: pertanyaan lanjutan untuk celah dan angka yang bertentangan.
  followUpResearch(project: ProjectBrief, notes: ResearchNote[]): Promise<{ questions: string[] }>;
  synthesizeBrief(
    project: ProjectBrief,
    notes: ResearchNote[],
    sources: NumberedSource[],
  ): Promise<Brief>;
  // Naskah bertahap (lib/ai/script-pipeline.ts): kerangka → tulis per bagian → periksa per bagian.
  outlineScript(project: ProjectBrief, briefMarkdown: string): Promise<Outline>;
  writeChapter(input: ChapterInput & { sceneCount: number; previous: string[] }): Promise<{ scenes: SceneDraft[] }>;
  reviewChapter(input: ChapterInput & { scenes: SceneDraft[] }): Promise<ChapterReview>;
  rewriteScene(input: {
    project: ProjectBrief;
    briefMarkdown: string;
    scene: SceneDraft;
    previous?: string;
    next?: string;
    instruction: string;
  }): Promise<SceneDraft>;
  rankAssets(project: ProjectBrief, scenes: RankingScene[]): Promise<AssetRanking>;
  // Editor AI memeriksa frame hasil render: teks terpotong, bertumpuk, layar kosong, salah ketik.
  reviewFrames(project: ProjectBrief, frames: ReviewFrame[]): Promise<FrameReview>;
}
