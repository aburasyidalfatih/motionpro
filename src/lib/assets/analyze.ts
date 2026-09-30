import sharp from "sharp";
import { scriptAI } from "@/lib/ai";
import type { ProjectBrief } from "@/lib/ai/types";
import { db } from "@/lib/db";
import { asJson } from "@/lib/projects";
import { storagePath } from "@/lib/storage";
import { USER_AGENT } from "./types";

// Kotak dalam koordinat gambar 0–1 (x, y dari kiri atas).
export type Box = { x: number; y: number; w: number; h: number };

// Hasil analisis gambar terpilih (SceneAsset.analysis), dibaca template untuk
// kamera yang mendekati subjek dan sorotan saat subjek disebut narasi.
export type ImageAnalysis = {
  focus: Box | null;
  subjects: { label: string; cue: string; box: Box }[];
  monochrome: boolean;
  distracting: boolean;
};

// [ymin, xmin, ymax, xmax] skala 0–1000 (format Gemini) → kotak 0–1; kotak rusak dibuang.
function toBox(box: number[]): Box | null {
  if (box.length !== 4) return null;
  const [ymin, xmin, ymax, xmax] = box.map((v) => Math.max(0, Math.min(1000, v)) / 1000);
  const w = xmax - xmin;
  const h = ymax - ymin;
  return w > 0.02 && h > 0.02 ? { x: xmin, y: ymin, w, h } : null;
}

// Gambar kecil kandidat untuk dinilai Gemini vision; null bila gagal diunduh.
export async function fetchThumbnail(url: string | null) {
  if (!url || !/^https?:/.test(url)) return undefined;
  try {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return undefined;
    const raw = Buffer.from(await response.arrayBuffer());
    if (raw.length > 5_000_000) return undefined;
    return await sharp(raw).resize({ width: 384, height: 384, fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
  } catch {
    return undefined;
  }
}

// Menganalisis gambar yang terpilih untuk adegan. Kegagalan (kuota, jaringan)
// hanya dicatat: tanpa analisis, template memakai gerakan kamera biasa.
export async function analyzeSelected(sceneId: string, project: ProjectBrief) {
  const link = await db.sceneAsset.findFirst({
    where: { sceneId, selected: true },
    include: { asset: true, scene: true },
  });
  if (!link || link.asset.kind !== "IMAGE" || !link.asset.localPath) return null;
  try {
    const image = await sharp(storagePath(link.asset.localPath))
      .resize({ width: 1024, height: 1024, fit: "inside" })
      .jpeg({ quality: 80 })
      .toBuffer();
    const draft = await scriptAI().analyzeImage(project, {
      narration: link.scene.narration,
      visualType: link.scene.visualType,
      image,
    });
    const analysis: ImageAnalysis = {
      focus: toBox(draft.focus),
      subjects: draft.subjects.flatMap((s) => {
        const box = toBox(s.box_2d);
        return box && s.label.trim() ? [{ label: s.label.trim(), cue: s.cue, box }] : [];
      }),
      monochrome: draft.monochrome,
      distracting: draft.distracting,
    };
    await db.sceneAsset.update({
      where: { sceneId_assetId: { sceneId, assetId: link.assetId } },
      data: { analysis: asJson(analysis) },
    });
    return analysis;
  } catch (err) {
    console.warn(`[analisis] adegan ${sceneId}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
