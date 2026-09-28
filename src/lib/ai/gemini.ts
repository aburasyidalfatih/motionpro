import { GoogleGenAI } from "@google/genai";
import { UnrecoverableError } from "bullmq";
import type { z } from "zod";
import {
  briefPrompt,
  planPrompt,
  researchPrompt,
  rewritePrompt,
  scriptPrompt,
  SYSTEM_PROMPT,
} from "./prompts";
import { briefSchema, researchPlanSchema, sceneSchema, scriptSchema, toGeminiSchema } from "./schemas";
import type { ResearchNote, ScriptAI, SourceRef } from "./types";

const DEFAULT_MODEL = "gemini-3.8-flash";

export function createGeminiAI(): ScriptAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Tidak ada gunanya dicoba ulang sampai .env diperbaiki.
    throw new UnrecoverableError("GEMINI_API_KEY belum diisi di .env (buat di https://aistudio.google.com)");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  async function generateJson<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: toGeminiSchema(schema),
      },
    });
    const text = response.text;
    if (!text) throw new Error("Gemini tidak mengembalikan jawaban");
    // Jawaban yang tidak sesuai skema dilempar sebagai error agar job dicoba ulang.
    return schema.parse(JSON.parse(text));
  }

  return {
    planResearch: (project) => generateJson(researchPlanSchema, planPrompt(project)),

    async research(project, question): Promise<ResearchNote> {
      const response = await ai.models.generateContent({
        model,
        contents: researchPrompt(project, question),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ googleSearch: {} }],
        },
      });
      const metadata = response.candidates?.[0]?.groundingMetadata;
      const sources: SourceRef[] = [];
      for (const chunk of metadata?.groundingChunks ?? []) {
        const url = chunk.web?.uri;
        if (url && !sources.some((s) => s.url === url)) {
          sources.push({ url, title: chunk.web?.title || chunk.web?.domain || url });
        }
      }
      return {
        question,
        text: response.text ?? "",
        sources,
        suggestionHtml: metadata?.searchEntryPoint?.renderedContent,
      };
    },

    synthesizeBrief: (project, notes, sources) =>
      generateJson(briefSchema, briefPrompt(project, notes, sources)),

    writeScript: (project, briefMarkdown) =>
      generateJson(scriptSchema, scriptPrompt(project, briefMarkdown)),

    rewriteScene: (input) => generateJson(sceneSchema, rewritePrompt(input)),
  };
}
