import { randomUUID } from "node:crypto";
import { UnrecoverableError } from "bullmq";
import type { Project, Scene } from "@/generated/prisma/client";
import { scriptAI } from "@/lib/ai";
import { generateIllustration, imageModel } from "@/lib/ai/image";
import { thirdPartyVisualTypes, type GraphicData } from "@/lib/ai/schemas";
import type { ProjectBrief } from "@/lib/ai/types";
import { findCandidates } from "@/lib/assets";
import { ensureLocal, processImage } from "@/lib/assets/download";
import type { AssetCandidate } from "@/lib/assets/types";
import { mapLimit } from "@/lib/async";
import { db } from "@/lib/db";
import { recomputeStatus } from "@/lib/project-status";
import { toProjectBrief } from "@/lib/projects";
import type { AssetJobInput } from "@/lib/queue";
import { saveFile } from "@/lib/storage";
import type { JobHandler } from "../types";

// Kandidat yang dinilai tidak relevan tetap disimpan (bisa dipilih manual),
// tapi diurutkan di belakang dan tidak dipilih otomatis.
const IRRELEVANT_RANK = 100;
// Jumlah adegan per panggilan Gemini untuk menilai relevansi.
const RANKING_BATCH = 15;

type Ranked = { candidate: AssetCandidate; rank: number };

// F-14: Gemini menilai kandidat tiap adegan dari judulnya. Bila penilaian
// gagal (kuota, jaringan), urutan hasil pencarian dipakai apa adanya.
async function rankCandidates(project: ProjectBrief, items: { scene: Scene; candidates: AssetCandidate[] }[]) {
  const ranked = new Map<string, Ranked[]>();
  for (let start = 0; start < items.length; start += RANKING_BATCH) {
    const batch = items.slice(start, start + RANKING_BATCH).filter((i) => i.candidates.length > 0);
    if (batch.length === 0) continue;
    let relevantByScene: Map<number, number[]> | undefined;
    try {
      const result = await scriptAI().rankAssets(
        project,
        batch.map(({ scene, candidates }) => ({
          narration: scene.narration,
          visualType: scene.visualType,
          candidates: candidates.map((c) => ({ title: c.title, provider: c.provider, kind: c.kind })),
        })),
      );
      relevantByScene = new Map(result.scenes.map((s) => [s.scene, s.relevant]));
    } catch (err) {
      console.warn(`[aset] penilaian relevansi dilewati: ${(err as Error).message}`);
    }
    batch.forEach(({ scene, candidates }, i) => {
      const relevant = relevantByScene?.get(i)?.filter((j) => j >= 0 && j < candidates.length);
      ranked.set(
        scene.id,
        candidates.map((candidate, j) => {
          if (!relevant) return { candidate, rank: j };
          const position = relevant.indexOf(j);
          return { candidate, rank: position === -1 ? IRRELEVANT_RANK + j : position };
        }),
      );
    });
  }
  return ranked;
}

// Menyimpan kandidat (Asset dibagi antarproyek, unik per penyedia + ID) lalu
// menautkannya ke adegan dengan urutan relevansi.
async function attachCandidates(sceneId: string, items: Ranked[]) {
  for (const { candidate, rank } of items) {
    const where = { provider_providerId: { provider: candidate.provider, providerId: candidate.providerId } };
    // Adegan lain bisa menyimpan aset yang sama pada saat bersamaan (P2002).
    const asset = await db.asset
      .upsert({ where, create: candidate, update: {} })
      .catch(() => db.asset.findUniqueOrThrow({ where }));
    await db.sceneAsset.upsert({
      where: { sceneId_assetId: { sceneId, assetId: asset.id } },
      create: { sceneId, assetId: asset.id, rank },
      update: { rank },
    });
  }
}

// Memilih kandidat relevan pertama yang berhasil diunduh (F-17). Kandidat yang
// gagal diunduh, misalnya file sudah dihapus dari sumbernya, dilewati.
async function selectFirstDownloadable(sceneId: string) {
  const links = await db.sceneAsset.findMany({
    where: { sceneId, rank: { lt: IRRELEVANT_RANK } },
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

// Kata kunci pencarian: untuk profil tokoh, potret dari namanya.
function searchQueries(scene: Scene) {
  const name = (scene.graphicData as GraphicData | null)?.profile?.name;
  if (scene.visualType === "profile" && name) return [`${name} portrait`, name, ...scene.keywords];
  return scene.keywords;
}

// Ilustrasi AI untuk adegan "illustration": dibuat dari prompt adegan (atau
// narasinya), disimpan sebagai aset dan langsung dipilih. Ilustrasi lama tetap
// ada sebagai kandidat, jadi pengguna bisa kembali ke versi sebelumnya.
async function illustrateScene(scene: Scene, project: Project) {
  const prompt = (scene.graphicData as GraphicData | null)?.illustration?.prompt || scene.narration;
  const image = await processImage(await generateIllustration(prompt, project.topic));
  const id = randomUUID();
  const localPath = await saveFile(`assets/illustration-${id}.jpg`, image.data);
  const asset = await db.asset.create({
    data: {
      kind: "IMAGE",
      provider: "gemini",
      providerId: id,
      title: prompt.slice(0, 200),
      license: `Dibuat AI (${imageModel()})`,
      localPath,
      width: image.width,
      height: image.height,
    },
  });
  await db.$transaction([
    db.sceneAsset.updateMany({ where: { sceneId: scene.id }, data: { selected: false, rank: { increment: 1 } } }),
    db.sceneAsset.create({ data: { sceneId: scene.id, assetId: asset.id, rank: 0, selected: true } }),
  ]);
}

// F-13, F-14, F-15, F-17: pencarian, penilaian relevansi, cari ulang, dan unduhan.
export const assets: JobHandler = async ({ run, setProgress }) => {
  if (!run.projectId) throw new UnrecoverableError("Job aset tanpa proyek");
  const project = await db.project.findUniqueOrThrow({ where: { id: run.projectId } });
  const brief = toProjectBrief(project);
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
    } else if (scene.visualType === "illustration") {
      // "Buat ulang gambar": prompt baru sudah disimpan ke adegan oleh halaman storyboard.
      await illustrateScene(scene, project);
    } else {
      // Cari ulang: kandidat lama yang tidak terpilih diganti hasil baru.
      const queries = (input.query ?? "")
        .split(",")
        .map((q) => q.trim())
        .filter(Boolean);
      const candidates = await findCandidates(scene.visualType, queries.length ? queries : searchQueries(scene));
      const ranked = await rankCandidates(brief, [{ scene, candidates }]);
      await db.sceneAsset.deleteMany({ where: { sceneId: scene.id, selected: false } });
      await attachCandidates(scene.id, ranked.get(scene.id) ?? []);
      if (!scene.assets.some((a) => a.selected)) await selectFirstDownloadable(scene.id);
    }
    await recomputeStatus(project.id);
    return { sceneId: scene.id };
  }

  // Cari ulang semua: kandidat hasil pencarian dihapus; aset unggahan pengguna
  // dan ilustrasi AI tetap (ilustrasi dibuat ulang per adegan dari storyboard).
  if (input.all) {
    await db.sceneAsset.deleteMany({
      where: { scene: { projectId: project.id }, asset: { provider: { notIn: ["upload", "gemini"] } } },
    });
  }

  // Ilustrasi AI untuk adegan "illustration" yang belum punya gambar. Kegagalan
  // satu ilustrasi (misalnya ditolak kebijakan model) tidak menggagalkan job.
  const toIllustrate = await db.scene.findMany({
    where: { projectId: project.id, visualType: "illustration", assets: { none: {} } },
    orderBy: { order: "asc" },
  });
  let illustrationFailures = 0;
  for (const scene of toIllustrate) {
    try {
      await illustrateScene(scene, project);
    } catch (err) {
      if (err instanceof UnrecoverableError) throw err;
      illustrationFailures++;
      console.warn(`[ilustrasi] adegan ${scene.id}: ${(err as Error).message}`);
    }
  }

  // Adegan lukisan/arsip/footage (dan profil tokoh pada gaya arsip, untuk
  // potretnya) yang belum punya kandidat hasil pencarian. Adegan grafis lain
  // digambar template, jadi tidak dicarikan aset.
  const searchTypes: string[] = [...thirdPartyVisualTypes, ...(project.style === "ARCHIVAL" ? ["profile"] : [])];
  const scenes = await db.scene.findMany({
    where: {
      projectId: project.id,
      visualType: { in: searchTypes },
      assets: { none: { asset: { provider: { not: "upload" } } } },
    },
    include: { assets: { where: { selected: true } } },
    orderBy: { order: "asc" },
  });

  // 1. Pencarian (0–50%).
  let searched = 0;
  const failures: string[] = [];
  const found = await mapLimit(scenes, 3, async (scene) => {
    let candidates: AssetCandidate[] = [];
    try {
      candidates = await findCandidates(scene.visualType, searchQueries(scene));
    } catch (err) {
      failures.push((err as Error).message);
    }
    searched++;
    await setProgress((searched / scenes.length) * 50);
    return { scene, candidates };
  });
  // Semua pencarian gagal biasanya berarti jaringan atau API key bermasalah.
  if (scenes.length > 0 && failures.length === scenes.length) throw new Error(failures[0]);

  // 2. Penilaian relevansi dengan Gemini (50–60%).
  const ranked = await rankCandidates(brief, found);
  await setProgress(60);

  // 3. Simpan kandidat dan unduh yang terpilih (60–100%).
  let saved = 0;
  let withoutAsset = 0;
  await mapLimit(found, 3, async ({ scene }) => {
    await attachCandidates(scene.id, ranked.get(scene.id) ?? []);
    const hasSelection = scene.assets.length > 0;
    if (!hasSelection && !(await selectFirstDownloadable(scene.id))) withoutAsset++;
    saved++;
    await setProgress(60 + (saved / found.length) * 40);
  });

  await recomputeStatus(project.id);
  return { scenes: scenes.length, withoutAsset, illustrations: toIllustrate.length - illustrationFailures };
};
