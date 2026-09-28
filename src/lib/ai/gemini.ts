import { ApiError, GoogleGenAI } from "@google/genai";
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
const MAX_ATTEMPTS = 4;
const MAX_WAIT_MS = 90_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Google menyertakan RetryInfo, misalnya "retryDelay": "37s", saat batas per menit tercapai.
function retryDelayMs(message: string) {
  const match = message.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  return match ? Math.min(Number(match[1]) * 1000 + 1000, MAX_WAIT_MS) : undefined;
}

// Kuota harian atau model tanpa kuota gratis (limit 0) tidak pulih dengan menunggu sebentar.
function isHardQuota(message: string) {
  return /PerDay|limit: 0\b/.test(message);
}

function quotaError(model: string) {
  return new UnrecoverableError(
    `Kuota Gemini untuk model ${model} habis (error 429). Cek pemakaian di https://aistudio.google.com/usage. ` +
      "Pilihan: tunggu kuota pulih, aktifkan billing di Google AI Studio, atau ganti GEMINI_MODEL di .env.",
  );
}

export function createGeminiAI(): ScriptAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Tidak ada gunanya dicoba ulang sampai .env diperbaiki.
    throw new UnrecoverableError("GEMINI_API_KEY belum diisi di .env (buat di https://aistudio.google.com)");
  }
  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  type Request = Omit<Parameters<typeof ai.models.generateContent>[0], "model">;

  // Batas per menit (429) dan server sibuk (503) ditunggu lalu dicoba lagi di sini,
  // agar satu adegan riset tidak menggagalkan seluruh job.
  async function generate(request: Request) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await ai.models.generateContent({ model, ...request });
      } catch (err) {
        const status = err instanceof ApiError ? err.status : undefined;
        if (status !== 429 && status !== 503) throw err;
        const message = err instanceof Error ? err.message : "";
        if (status === 429 && isHardQuota(message)) throw quotaError(model);
        if (attempt >= MAX_ATTEMPTS) {
          if (status === 429) throw quotaError(model);
          throw err;
        }
        const wait = retryDelayMs(message) ?? 15_000 * attempt;
        console.warn(`[gemini] ${status}, menunggu ${Math.round(wait / 1000)} detik (percobaan ${attempt})`);
        await sleep(wait);
      }
    }
  }

  async function generateJson<T>(schema: z.ZodType<T>, prompt: string): Promise<T> {
    const response = await generate({
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
      const response = await generate({
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
