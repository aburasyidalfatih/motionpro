import { UnrecoverableError } from "bullmq";
import type { Scene } from "@/generated/prisma/client";
import { scriptAI } from "@/lib/ai";
import { moods, visualTypes, type SceneDraft } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { asJson, estimateDurationMs, toProjectBrief } from "@/lib/projects";
import type { ScriptJobInput } from "@/lib/queue";
import type { JobHandler } from "../types";

function sceneFields(draft: SceneDraft) {
  const mapData = draft.map || draft.timeline ? { map: draft.map, timeline: draft.timeline } : undefined;
  return {
    narration: draft.narration,
    onScreenText: draft.onScreenText || null,
    keywords: draft.keywords,
    visualType: draft.visualType,
    mood: draft.mood,
    mapData: mapData ? asJson(mapData) : undefined,
    durationMs: estimateDurationMs(draft.narration),
  };
}

function toDraft(scene: Scene): SceneDraft {
  const data = (scene.mapData ?? {}) as Pick<SceneDraft, "map" | "timeline">;
  return {
    narration: scene.narration,
    onScreenText: scene.onScreenText ?? "",
    keywords: scene.keywords,
    visualType: visualTypes.find((v) => v === scene.visualType) ?? "painting",
    mood: moods.find((m) => m === scene.mood) ?? "calm",
    map: data.map,
    timeline: data.timeline,
  };
}

// Naskah (F-09): ditulis hanya dari research brief, dipecah per adegan.
// Dengan input.sceneId, hanya satu adegan yang ditulis ulang (F-10).
export const script: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job naskah tanpa proyek");
  const project = await db.project.findUniqueOrThrow({
    where: { id: run.projectId },
    include: { research: true },
  });
  const briefMarkdown = project.research?.markdown.trim();
  if (!briefMarkdown) throw new UnrecoverableError("Research brief belum ada atau kosong");
  const ai = scriptAI();
  const input = (run.input ?? {}) as ScriptJobInput;

  if (input.sceneId) {
    const scenes = await db.scene.findMany({ where: { projectId: project.id }, orderBy: { order: "asc" } });
    const index = scenes.findIndex((s) => s.id === input.sceneId);
    if (index === -1) throw new UnrecoverableError("Adegan tidak ditemukan");
    const draft = await ai.rewriteScene({
      project: toProjectBrief(project),
      briefMarkdown,
      scene: toDraft(scenes[index]),
      previous: scenes[index - 1]?.narration,
      next: scenes[index + 1]?.narration,
      instruction: input.instruction ?? "",
    });
    await db.scene.update({ where: { id: input.sceneId }, data: sceneFields(draft) });
    return { rewritten: input.sceneId };
  }

  await setProgress(10);
  const result = await ai.writeScript(toProjectBrief(project), briefMarkdown);
  await setProgress(90);

  await db.$transaction(async (tx) => {
    await tx.scene.deleteMany({ where: { projectId: project.id } });
    await tx.scene.createMany({
      data: result.scenes.map((draft, order) => ({ projectId: project.id, order, ...sceneFields(draft) })),
    });
    await tx.project.update({
      where: { id: project.id },
      data: { status: "SCRIPT_READY", failedStage: null },
    });
  });

  return { title: result.title, scenes: result.scenes.length };
};
