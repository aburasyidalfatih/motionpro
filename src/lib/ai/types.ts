import type { Brief, ResearchPlan, SceneDraft, Script } from "./schemas";

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

// Semua panggilan AI untuk riset dan naskah. Implementasinya Gemini
// (produksi) atau tiruan (uji tanpa API key, AI_PROVIDER=fake).
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
}
