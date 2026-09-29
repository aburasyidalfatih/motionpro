import { UnrecoverableError } from "bullmq";
import { scriptAI } from "@/lib/ai";
import { runResearch } from "@/lib/ai/research-pipeline";
import { db } from "@/lib/db";
import { asJson, briefToMarkdown, toProjectBrief } from "@/lib/projects";
import type { JobHandler } from "../types";

// Riset (F-04, F-05, F-07, F-08): dua putaran riset dengan Google Search
// (lib/ai/research-pipeline.ts) → brief bersumber yang bisa diedit pengguna.
export const research: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job riset tanpa proyek");
  const project = await db.project.findUniqueOrThrow({ where: { id: run.projectId } });
  const {
    questions,
    notes,
    sources,
    brief: result,
  } = await runResearch(scriptAI(), toProjectBrief(project), (fraction) => setProgress(fraction * 100));
  const suggestions = [...new Set(notes.map((n) => n.suggestionHtml).filter(Boolean))];
  const data = {
    questions: asJson(questions),
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

  return { questions: questions.length, sources: sources.length, facts: result.facts.length };
};
