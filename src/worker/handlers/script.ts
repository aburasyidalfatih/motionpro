import { UnrecoverableError } from "bullmq";
import { Prisma, type Scene } from "@/generated/prisma/client";
import { scriptAI } from "@/lib/ai";
import { writeFullScript } from "@/lib/ai/script-pipeline";
import { moods, visualTypes, type GraphicData, type SceneDraft } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { geocodeMap } from "@/lib/geocode";
import { deleteVoiceover } from "@/lib/project-jobs";
import { recomputeStatus } from "@/lib/project-status";
import { asJson, estimateDurationMs, toProjectBrief } from "@/lib/projects";
import { normalizeScene } from "@/lib/scene-normalize";
import type { ScriptJobInput } from "@/lib/queue";
import type { JobHandler } from "../types";

const GRAPHIC_KEYS = [
  "map",
  "timeline",
  "kinetic",
  "events",
  "stats",
  "comparison",
  "quote",
  "chart",
  "profile",
] as const;

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

// Koordinat peta dari OpenStreetMap, bukan tebakan AI (lihat lib/geocode.ts).
async function geocodeDraft<T extends Partial<SceneDraft>>(draft: T): Promise<{ draft: T; verified: number }> {
  if (!draft.map) return { draft, verified: 0 };
  const { map, verified } = await geocodeMap(draft.map);
  return { draft: { ...draft, map }, verified };
}

// Memeriksa ulang koordinat semua peta proyek, misalnya untuk naskah lama.
// Tidak pernah melempar error: kegagalan job SCRIPT menandai proyek gagal dan
// "coba lagi" akan menulis ulang seluruh naskah.
async function geocodeProject(projectId: string, setProgress: (progress: number) => Promise<void>) {
  const scenes = await db.scene.findMany({ where: { projectId }, orderBy: { order: "asc" } });
  const maps = scenes.filter((s) => (s.graphicData as GraphicData | null)?.map);
  let verified = 0;
  let points = 0;
  for (const [i, scene] of maps.entries()) {
    try {
      const graphic = scene.graphicData as GraphicData;
      const result = await geocodeDraft(graphic);
      verified += result.verified;
      points += graphic.map?.points.length ?? 0;
      await db.scene.update({ where: { id: scene.id }, data: { graphicData: asJson(result.draft) } });
      await setProgress(((i + 1) / maps.length) * 100);
    } catch (err) {
      console.warn(`[geocode] adegan ${scene.id} dilewati: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { maps: maps.length, points, verified };
}

// Naskah (F-09): ditulis hanya dari research brief, bertahap per bab
// (lib/ai/script-pipeline.ts), dipecah per adegan.
// Dengan input.sceneId, hanya satu adegan yang ditulis ulang (F-10); dengan
// input.geocode, hanya koordinat peta yang diperiksa ulang.
export const script: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job naskah tanpa proyek");
  const project = await db.project.findUniqueOrThrow({
    where: { id: run.projectId },
    include: { research: true },
  });
  const input = (run.input ?? {}) as ScriptJobInput;
  if (input.geocode) return geocodeProject(project.id, setProgress);

  const briefMarkdown = project.research?.markdown.trim();
  if (!briefMarkdown) throw new UnrecoverableError("Research brief belum ada atau kosong");
  const ai = scriptAI();

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
    const { draft: located } = await geocodeDraft(draft);
    await db.scene.update({
      where: { id: input.sceneId },
      data: sceneFields(normalizeScene(located, project.style)),
    });
    // Narasi berubah, jadi voice over lama tidak cocok lagi.
    await deleteVoiceover(input.sceneId);
    await recomputeStatus(project.id);
    return { rewritten: input.sceneId };
  }

  await setProgress(5);
  const result = await writeFullScript(ai, toProjectBrief(project), briefMarkdown, (fraction) =>
    setProgress(5 + fraction * 75),
  );
  await setProgress(80);
  const drafts: SceneDraft[] = [];
  for (const scene of result.scenes) {
    drafts.push((await geocodeDraft(scene)).draft);
    await setProgress(80 + (drafts.length / result.scenes.length) * 15);
  }

  await db.$transaction(async (tx) => {
    await tx.scene.deleteMany({ where: { projectId: project.id } });
    await tx.scene.createMany({
      data: drafts.map((draft, order) => ({
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

  return {
    title: result.title,
    chapters: result.outline.chapters.length,
    scenes: result.scenes.length,
    fixes: result.issues.length,
  };
};
