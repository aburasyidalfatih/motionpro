import { UnrecoverableError } from "bullmq";
import { SECONDS_PER_SCENE, type ScriptPart } from "./prompts";
import type { Outline, SceneDraft } from "./schemas";
import type { ProjectBrief, ScriptAI } from "./types";

// Naskah ditulis bertahap, seperti di ruang redaksi: kerangka bab dengan open
// loop → tiap bagian ditulis dengan kerangka dan narasi sebelumnya sebagai
// konteks → tiap bagian diperiksa editor (fakta, retensi, data grafis). Menulis
// 60–100 adegan dalam satu panggilan membuat bagian tengah dan akhir melemah.

const OPENING_SECONDS = 25;

// Jumlah adegan per bagian: pembuka sekitar 25 detik, sisa durasi dibagi ke
// bab menurut perkiraan menit dari kerangka.
export function sceneBudget(outline: Outline, targetMinutes: number) {
  const opening = Math.max(2, Math.round(OPENING_SECONDS / SECONDS_PER_SCENE));
  const remaining = Math.max(60, targetMinutes * 60 - OPENING_SECONDS);
  const weights = outline.chapters.map((c) => Math.max(0.3, c.minutes || 1));
  const total = weights.reduce((sum, w) => sum + w, 0);
  const chapters = weights.map((w) => Math.max(3, Math.round((remaining * w) / total / SECONDS_PER_SCENE)));
  return { opening, chapters };
}

// Struktur bab dipakai template (kartu bab, musik per bab): pembuka diakhiri
// kartu judul video dan tiap bab diawali kartu bab. Adegan "title" di tempat
// lain dijadikan teks kinetik agar tidak dianggap bab baru.
function withTitleCards(scenes: SceneDraft[], part: ScriptPart, outline: Outline): SceneDraft[] {
  const titleAt = part.kind === "opening" ? scenes.length - 1 : 0;
  const result = scenes.map((scene, i) =>
    scene.visualType === "title" && i !== titleAt ? { ...scene, visualType: "kinetic_text" as const } : scene,
  );
  if (result[titleAt]?.visualType === "title") return result;
  const title = part.kind === "opening" ? outline.title : outline.chapters[part.index].title;
  const card: SceneDraft = {
    narration: part.kind === "opening" ? `${outline.title}.` : `Bab ${part.index + 1}: ${title}.`,
    onScreenText: title,
    keywords: [],
    visualType: "title",
    mood: part.kind === "opening" ? "epic" : outline.chapters[part.index].mood,
  };
  return part.kind === "opening" ? [...result, card] : [card, ...result];
}

export type WrittenScript = { title: string; scenes: SceneDraft[]; outline: Outline; issues: string[] };

export async function writeFullScript(
  ai: ScriptAI,
  project: ProjectBrief,
  briefMarkdown: string,
  onProgress: (fraction: number) => Promise<void> = async () => {},
): Promise<WrittenScript> {
  const outline = await ai.outlineScript(project, briefMarkdown);
  const budget = sceneBudget(outline, project.targetMinutes);
  const parts: { part: ScriptPart; sceneCount: number }[] = [
    { part: { kind: "opening" }, sceneCount: budget.opening },
    ...outline.chapters.map((_, index) => ({
      part: { kind: "chapter", index } as const,
      sceneCount: budget.chapters[index],
    })),
  ];
  // Pemeriksaan editor bisa dimatikan untuk menghemat kuota (SCRIPT_REVIEW=off).
  const review = process.env.SCRIPT_REVIEW !== "off";
  const steps = 1 + parts.length * (review ? 2 : 1);
  let done = 1;
  await onProgress(done / steps);

  const scenes: SceneDraft[] = [];
  const issues: string[] = [];
  for (const { part, sceneCount } of parts) {
    const input = { project, briefMarkdown, outline, part };
    const draft = await ai.writeChapter({
      ...input,
      sceneCount,
      previous: scenes.slice(-3).map((s) => s.narration),
    });
    await onProgress(++done / steps);

    let final = draft.scenes;
    if (review) {
      try {
        const checked = await ai.reviewChapter({ ...input, scenes: draft.scenes });
        // Hasil pemeriksaan yang membuang banyak adegan tidak dipakai.
        if (checked.scenes.length >= Math.ceil(draft.scenes.length * 0.6)) {
          final = checked.scenes;
          issues.push(...checked.issues);
        }
      } catch (err) {
        // Kuota habis atau kunci salah menghentikan job; kegagalan lain cukup
        // memakai draf tanpa pemeriksaan daripada menulis ulang semuanya.
        if (err instanceof UnrecoverableError) throw err;
        console.warn(`[naskah] pemeriksaan dilewati: ${err instanceof Error ? err.message : String(err)}`);
      }
      await onProgress(++done / steps);
    }
    scenes.push(...withTitleCards(final, part, outline));
  }

  return { title: outline.title, scenes, outline, issues };
}
