import { UnrecoverableError } from "bullmq";
import { Prisma, type Scene } from "@/generated/prisma/client";
import { scriptAI } from "@/lib/ai";
import { moods, visualTypes, type GraphicData, type SceneDraft } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { deleteVoiceover } from "@/lib/project-jobs";
import { recomputeStatus } from "@/lib/project-status";
import { asJson, estimateDurationMs, toProjectBrief } from "@/lib/projects";
import { normalizeScene } from "@/lib/scene-normalize";
import type { ScriptJobInput } from "@/lib/queue";
import type { JobHandler } from "../types";

const GRAPHIC_KEYS = ["map", "timeline", "kinetic", "events", "stats", "comparison", "quote"] as const;

// Data grafis adegan dari jawaban Gemini; kunci yang kosong tidak disimpan.
export function graphicDataOf(draft: Partial<SceneDraft>): GraphicData | null {
  const data: GraphicData = {};
  for (const key of GRAPHIC_KEYS) {
    if (draft[key] !== undefined) Object.assign(data, { [key]: draft[key] });
  }
  return Object.keys(data).length ? data : null;
}

function sceneFields(draft: SceneDraft) {
  const graphicData = graphicDataOf(draft);
  return {
    narration: draft.narration,
    onScreenText: draft.onScreenText || null,
    keywords: draft.keywords,
    visualType: draft.visualType,
    mood: draft.mood,
    graphicData: graphicData ? asJson(graphicData) : Prisma.DbNull,
    durationMs: estimateDurationMs(draft.narration),
  };
}

function toDraft(scene: Scene): SceneDraft {
  const data = (scene.graphicData ?? {}) as GraphicData;
  return {
    narration: scene.narration,
    onScreenText: scene.onScreenText ?? "",
    keywords: scene.keywords,
    visualType: visualTypes.find((v) => v === scene.visualType) ?? "kinetic_text",
    mood: moods.find((m) => m === scene.mood) ?? "calm",
    ...data,
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
    await db.scene.update({
      where: { id: input.sceneId },
      data: sceneFields(normalizeScene(draft, project.style)),
    });
    // Narasi berubah, jadi voice over lama tidak cocok lagi.
    await deleteVoiceover(input.sceneId);
    await recomputeStatus(project.id);
    return { rewritten: input.sceneId };
  }

  await setProgress(10);
  const result = await ai.writeScript(toProjectBrief(project), briefMarkdown);
  await setProgress(90);

  await db.$transaction(async (tx) => {
    await tx.scene.deleteMany({ where: { projectId: project.id } });
    await tx.scene.createMany({
      data: result.scenes.map((draft, order) => ({
        projectId: project.id,
        order,
        ...sceneFields(normalizeScene(draft, project.style)),
      })),
    });
    await tx.project.update({
      where: { id: project.id },
      data: { status: "SCRIPT_READY", failedStage: null },
    });
  });
  // Adegan grafis tidak butuh aset, jadi proyek full grafis langsung "Aset siap".
  await recomputeStatus(project.id);

  return { title: result.title, scenes: result.scenes.length };
};
