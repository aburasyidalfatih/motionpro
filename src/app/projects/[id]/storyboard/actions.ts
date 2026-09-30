"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { GraphicData } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { hasActiveStageJob } from "@/lib/project-jobs";
import { recomputeStatus } from "@/lib/project-status";
import { asJson } from "@/lib/projects";
import { findSceneOrRefresh } from "@/lib/scenes";
import { enqueueJob, type AssetJobInput } from "@/lib/queue";

// F-13: mencari aset untuk adegan yang belum punya kandidat, atau semua adegan (all).
export async function startAssets(projectId: string, all = false) {
  if (await hasActiveStageJob(projectId)) return;
  const project = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  if (project.status === "FAILED") {
    await db.project.update({ where: { id: projectId }, data: { status: "SCRIPT_READY", failedStage: null } });
  }
  const input: AssetJobInput = { all };
  await enqueueJob("ASSETS", { projectId, input });
  redirect(`/projects/${projectId}/storyboard`);
}

// F-15: memilih kandidat lain. Worker mengunduhnya bila perlu dan menganalisisnya.
export async function selectAsset(sceneId: string, assetId: string) {
  const scene = await findSceneOrRefresh(sceneId);
  if (!scene) return;
  // Kandidat bisa sudah diganti oleh "Cari ulang" sebelum halaman dimuat ulang.
  const link = await db.sceneAsset.findUnique({ where: { sceneId_assetId: { sceneId, assetId } } });
  if (!link) return refresh();
  await db.$transaction([
    db.sceneAsset.updateMany({ where: { sceneId }, data: { selected: false } }),
    db.sceneAsset.update({ where: { sceneId_assetId: { sceneId, assetId } }, data: { selected: true } }),
  ]);
  // Diunduh bila belum ada, lalu dianalisis (fokus kamera dan sorotan) oleh worker.
  const input: AssetJobInput = { sceneId, downloadOnly: true };
  await enqueueJob("ASSETS", { projectId: scene.projectId, input });
  await recomputeStatus(scene.projectId);
  refresh();
}

// F-15: mencari ulang kandidat untuk satu adegan dengan kata kunci baru.
export async function searchSceneAssets(sceneId: string, formData: FormData) {
  const scene = await findSceneOrRefresh(sceneId);
  if (!scene) return;
  const query = String(formData.get("query") ?? "").trim();
  if (scene.visualType === "illustration") {
    // Ilustrasi AI: isian adalah prompt gambar, disimpan ke data grafis adegan.
    const graphic = (scene.graphicData ?? {}) as GraphicData;
    if (query) {
      await db.scene.update({
        where: { id: sceneId },
        data: { graphicData: asJson({ ...graphic, illustration: { prompt: query } }) },
      });
    }
    const input: AssetJobInput = { sceneId };
    await enqueueJob("ASSETS", { projectId: scene.projectId, input });
    refresh();
    return;
  }
  const keywords = query.split(",").map((k) => k.trim()).filter(Boolean);
  // Kata kunci baru disimpan ke adegan agar tetap tampil dan dipakai lagi nanti.
  if (keywords.length) await db.scene.update({ where: { id: sceneId }, data: { keywords } });
  const input: AssetJobInput = { sceneId, query };
  await enqueueJob("ASSETS", { projectId: scene.projectId, input });
  refresh();
}
