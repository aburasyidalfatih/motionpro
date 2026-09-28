import { createFakeAI } from "./fake";
import { createGeminiAI } from "./gemini";
import type { ScriptAI } from "./types";

let instance: ScriptAI | undefined;

// AI_PROVIDER=fake menjalankan alur dengan data contoh, tanpa memanggil Gemini.
export function scriptAI(): ScriptAI {
  instance ??= process.env.AI_PROVIDER === "fake" ? createFakeAI() : createGeminiAI();
  return instance;
}
