import type { AssetRanking, Brief, ResearchPlan, SceneDraft, Script } from "./schemas";

export type ProjectBrief = {
  topic: string;
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

// Semua panggilan AI teks: riset, naskah, dan pemilihan aset. Implementasinya
// Gemini (produksi) atau tiruan (uji tanpa API key, AI_PROVIDER=fake).
export interface ScriptAI {
  planResearch(project: ProjectBrief): Promise<ResearchPlan>;
  research(project: ProjectBrief, question: string): Promise<ResearchNote>;
  synthesizeBrief(
    project: ProjectBrief,
    notes: ResearchNote[],
    sources: NumberedSource[],
  ): Promise<Brief>;
  writeScript(project: ProjectBrief, briefMarkdown: string): Promise<Script>;
  rewriteScene(input: {
    project: ProjectBrief;
    briefMarkdown: string;
    scene: SceneDraft;
    previous?: string;
    next?: string;
    instruction: string;
  }): Promise<SceneDraft>;
  rankAssets(project: ProjectBrief, scenes: RankingScene[]): Promise<AssetRanking>;
}
