import { UnrecoverableError } from "bullmq";
import { scriptAI } from "@/lib/ai";
import type { NumberedSource } from "@/lib/ai/types";
import { mapLimit } from "@/lib/async";
import { db } from "@/lib/db";
import { asJson, briefToMarkdown, toProjectBrief } from "@/lib/projects";
import type { JobHandler } from "../types";

// Riset (F-04, F-05, F-07, F-08): rencana pertanyaan → riset tiap pertanyaan
// dengan Google Search → brief bersumber yang bisa diedit pengguna.
export const research: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job riset tanpa proyek");
  const project = await db.project.findUniqueOrThrow({ where: { id: run.projectId } });
  const brief = toProjectBrief(project);
  const ai = scriptAI();

  const plan = await ai.planResearch(brief);
  await setProgress(10);

  let done = 0;
  const notes = await mapLimit(plan.questions, 3, async (question) => {
    const note = await ai.research(brief, question);
    done++;
    await setProgress(10 + (done / plan.questions.length) * 70);
    return note;
  });

  // Sumber dari semua catatan diberi nomor [1], [2], ... tanpa duplikat.
  const sources: NumberedSource[] = [];
  for (const note of notes) {
    for (const source of note.sources) {
      if (!sources.some((s) => s.url === source.url)) {
        sources.push({ ...source, position: sources.length + 1 });
      }
    }
  }

  const result = await ai.synthesizeBrief(brief, notes, sources);
  // Buang nomor sumber yang tidak ada di daftar.
  for (const fact of result.facts) {
    fact.sources = fact.sources.filter((n) => n >= 1 && n <= sources.length);
  }
  await setProgress(95);

  const suggestions = [...new Set(notes.map((n) => n.suggestionHtml).filter(Boolean))];
  const data = {
    questions: asJson(plan.questions),
    facts: asJson(result.facts),
    timeline: asJson(result.timeline),
    hooks: asJson(result.hooks),
    markdown: briefToMarkdown(result),
    searchSuggestions: asJson(suggestions),
  };

  await db.$transaction(async (tx) => {
    const saved = await tx.researchBrief.upsert({
      where: { projectId: project.id },
      create: { projectId: project.id, ...data },
      update: data,
    });
    await tx.source.deleteMany({ where: { briefId: saved.id } });
    await tx.source.createMany({
      data: sources.map((s) => ({ briefId: saved.id, position: s.position, title: s.title, url: s.url })),
    });
    await tx.project.update({
      where: { id: project.id },
      data: { status: "RESEARCH_READY", failedStage: null },
    });
  });

  return { questions: plan.questions.length, sources: sources.length, facts: result.facts.length };
};
