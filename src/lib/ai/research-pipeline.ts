import { mapLimit } from "@/lib/async";
import { aiConcurrency } from "./index";
import type { Brief } from "./schemas";
import type { NumberedSource, ProjectBrief, ResearchNote, ScriptAI } from "./types";

// Riset dua putaran: rencana pertanyaan → riset tiap pertanyaan dengan Google
// Search → editor riset mencari celah dan angka yang bertentangan → riset
// pertanyaan lanjutan → brief bersumber.
export async function runResearch(
  ai: ScriptAI,
  project: ProjectBrief,
  onProgress: (fraction: number) => Promise<void> = async () => {},
): Promise<{ questions: string[]; notes: ResearchNote[]; sources: NumberedSource[]; brief: Brief }> {
  const plan = await ai.planResearch(project);
  await onProgress(0.1);

  // Perkiraan jumlah pertanyaan total untuk progres; putaran kedua paling banyak 6.
  let expected = plan.questions.length + 3;
  let done = 0;
  const ask = (questions: string[]) =>
    mapLimit(questions, aiConcurrency(), async (question) => {
      const note = await ai.research(project, question);
      done++;
      await onProgress(0.1 + Math.min(1, done / expected) * 0.75);
      return note;
    });

  const first = await ask(plan.questions);
  const followUp = await ai.followUpResearch(project, first).catch((err) => {
    // Putaran kedua melengkapi, bukan syarat: tanpa pertanyaan lanjutan brief tetap bisa disusun.
    console.warn(`[riset] putaran kedua dilewati: ${err instanceof Error ? err.message : String(err)}`);
    return { questions: [] };
  });
  expected = plan.questions.length + followUp.questions.length;
  const second = await ask(followUp.questions);
  const notes = [...first, ...second];

  // Sumber dari semua catatan diberi nomor [1], [2], ... tanpa duplikat.
  const sources: NumberedSource[] = [];
  for (const note of notes) {
    for (const source of note.sources) {
      if (!sources.some((s) => s.url === source.url)) {
        sources.push({ ...source, position: sources.length + 1 });
      }
    }
  }

  const brief = await ai.synthesizeBrief(project, notes, sources);
  // Buang nomor sumber yang tidak ada di daftar.
  const valid = (numbers: number[]) => numbers.filter((n) => n >= 1 && n <= sources.length);
  for (const fact of brief.facts) fact.sources = valid(fact.sources);
  for (const quote of brief.quotes) quote.sources = valid(quote.sources);
  await onProgress(0.95);

  return { questions: [...plan.questions, ...followUp.questions], notes, sources, brief };
}
