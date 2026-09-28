import { ApiError } from "@google/genai";
import type { z } from "zod";
import { fatalError, geminiClient, type GeminiRequest } from "./client";
import {
  briefPrompt,
  planPrompt,
  rankAssetsPrompt,
  researchPrompt,
  rewritePrompt,
  scriptPrompt,
  SYSTEM_PROMPT,
} from "./prompts";
import {
  assetRankingSchema,
  briefSchema,
  researchPlanSchema,
  sceneSchema,
  scriptSchema,
  toGeminiSchema,
} from "./schemas";
import type { ResearchNote, ScriptAI, SourceRef } from "./types";

const DEFAULT_MODEL = "gemini-3.8-flash";

export function createGeminiAI(): ScriptAI {
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const { generate: generateWith } = geminiClient();
  const generate = (request: GeminiRequest) => generateWith(model, request);

  async function generateJson<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    const jsonSchema = toGeminiSchema(schema);
    let response;
    try {
      response = await generate({
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
        },
      });
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 400)) throw fatalError(err, model);
      // Skema ditolak (terlalu kompleks untuk model ini): minta JSON biasa dengan
      // skema di dalam prompt, lalu validasi jawabannya dengan zod.
      console.warn("[gemini] skema ditolak (400), mencoba mode JSON tanpa skema");
      response = await generate({
        contents: `${prompt}\n\nJawab HANYA dengan JSON yang sesuai JSON Schema berikut:\n${JSON.stringify(jsonSchema)}`,
        config: { systemInstruction: SYSTEM_PROMPT, responseMimeType: "application/json" },
      }).catch((retryErr) => {
        throw fatalError(retryErr, model);
      });
    }
    const text = response.text;
    if (!text) throw new Error("Gemini tidak mengembalikan jawaban");
    // Jawaban yang tidak sesuai skema dilempar sebagai error agar job dicoba ulang.
    return schema.parse(JSON.parse(text));
  }

  return {
    planResearch: (project) => generateJson(researchPlanSchema, planPrompt(project)),

    async research(project, question): Promise<ResearchNote> {
      const response = await generate({
        contents: researchPrompt(project, question),
        config: {
          systemInstruction: SYSTEM_PROMPT,
          tools: [{ googleSearch: {} }],
        },
      }).catch((err) => {
        throw fatalError(err, model);
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

    rankAssets: (project, scenes) => generateJson(assetRankingSchema, rankAssetsPrompt(project, scenes)),
  };
}
