import { UnrecoverableError } from "bullmq";
import { findCandidates } from "@/lib/assets";
import { ensureLocal } from "@/lib/assets/download";
import type { AssetCandidate } from "@/lib/assets/types";
import { mapLimit } from "@/lib/async";
import { db } from "@/lib/db";
import { recomputeStatus } from "@/lib/project-status";
import type { AssetJobInput } from "@/lib/queue";
import type { JobHandler } from "../types";

// Menyimpan kandidat (Asset dibagi antarproyek, unik per penyedia + ID) lalu
// menautkannya ke adegan dengan urutan relevansi.
async function attachCandidates(sceneId: string, candidates: AssetCandidate[], startRank: number) {
  const assets = [];
  for (const candidate of candidates) {
    const where = { provider_providerId: { provider: candidate.provider, providerId: candidate.providerId } };
    // Adegan lain bisa menyimpan aset yang sama pada saat bersamaan (P2002).
    const asset = await db.asset
      .upsert({ where, create: candidate, update: {} })
      .catch(() => db.asset.findUniqueOrThrow({ where }));
    assets.push(asset);
  }
  for (const [i, asset] of assets.entries()) {
    await db.sceneAsset.upsert({
      where: { sceneId_assetId: { sceneId, assetId: asset.id } },
      create: { sceneId, assetId: asset.id, rank: startRank + i },
      update: { rank: startRank + i },
    });
  }
  return assets;
}

// Memilih kandidat pertama yang berhasil diunduh (F-17). Kandidat yang gagal
// diunduh, misalnya file sudah dihapus dari sumbernya, dilewati.
async function selectFirstDownloadable(sceneId: string) {
  const links = await db.sceneAsset.findMany({
    where: { sceneId },
    orderBy: { rank: "asc" },
    include: { asset: true },
  });
  for (const link of links.slice(0, 4)) {
    try {
      await ensureLocal(link.asset);
      await db.$transaction([
        db.sceneAsset.updateMany({ where: { sceneId }, data: { selected: false } }),
        db.sceneAsset.update({
          where: { sceneId_assetId: { sceneId, assetId: link.assetId } },
          data: { selected: true },
        }),
      ]);
      return true;
    } catch (err) {
      console.warn(`[aset] ${link.asset.provider} ${link.asset.providerId}: ${(err as Error).message}`);
    }
  }
  return false;
}

// F-13, F-15, F-17: pencarian aset per adegan, cari ulang, dan unduh aset terpilih.
export const assets: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job aset tanpa proyek");
  const input = (run.input ?? {}) as AssetJobInput;

  if (input.sceneId) {
    const scene = await db.scene.findUnique({
      where: { id: input.sceneId },
      include: { assets: { include: { asset: true } } },
    });
    if (!scene) throw new UnrecoverableError("Adegan tidak ditemukan");

    if (input.downloadOnly) {
      const selected = scene.assets.find((a) => a.selected);
      if (selected) await ensureLocal(selected.asset);
    } else {
      // Cari ulang: kandidat lama yang tidak terpilih diganti hasil baru.
      const queries = (input.query ?? "").split(",").map((q) => q.trim()).filter(Boolean);
      const candidates = await findCandidates(scene.visualType, queries.length ? queries : scene.keywords);
      await db.sceneAsset.deleteMany({ where: { sceneId: scene.id, selected: false } });
      await attachCandidates(scene.id, candidates, 1);
      if (!scene.assets.some((a) => a.selected)) await selectFirstDownloadable(scene.id);
    }
    await recomputeStatus(run.projectId);
    return { sceneId: scene.id };
  }

  // Semua adegan yang belum punya kandidat.
  const scenes = await db.scene.findMany({
    where: { projectId: run.projectId, assets: { none: {} } },
    orderBy: { order: "asc" },
  });
  let done = 0;
  let empty = 0;
  const failures: string[] = [];
  await mapLimit(scenes, 3, async (scene) => {
    try {
      const candidates = await findCandidates(scene.visualType, scene.keywords);
      await attachCandidates(scene.id, candidates, 0);
      if (candidates.length === 0 || !(await selectFirstDownloadable(scene.id))) empty++;
    } catch (err) {
      failures.push((err as Error).message);
    }
    done++;
    await setProgress((done / scenes.length) * 100);
  });

  await recomputeStatus(run.projectId);
  // Semua pencarian gagal biasanya berarti jaringan atau API key bermasalah.
  if (scenes.length > 0 && failures.length === scenes.length) throw new Error(failures[0]);
  return { scenes: scenes.length, withoutAsset: empty + failures.length };
};
