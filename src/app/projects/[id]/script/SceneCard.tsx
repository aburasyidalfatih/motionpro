import type { Scene } from "@/generated/prisma/client";
import { SubmitButton } from "@/components/SubmitButton";
import { moods, needsAsset, visualTypes, type GraphicData } from "@/lib/ai/schemas";
import { moodLabel, visualTypeLabel } from "@/lib/labels";
import { formatDuration } from "@/lib/projects";
import { addSceneAfter, deleteScene, moveScene, rewriteScene, saveScene } from "../actions";
import { GraphicDataField } from "./GraphicDataField";

const field = "mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-1.5 text-sm dark:border-zinc-700";

// Ringkasan satu baris data grafis adegan.
function describeGraphic(g: GraphicData) {
  const parts: string[] = [];
  if (g.kinetic) parts.push(`Teks: ${g.kinetic.lines.join(" / ")}`);
  if (g.map) {
    const arrows = g.map.arrows?.length ? ` · ${g.map.arrows.length} panah` : "";
    const sides = g.map.sides?.length ? ` · ${g.map.sides.join(" vs ")}` : "";
    // ✓ = koordinat dari OpenStreetMap, ? = tebakan AI yang tidak ditemukan di OpenStreetMap.
    const points = g.map.points.map((p) => `${p.label}${p.verified ? " ✓" : p.verified === false ? " ?" : ""}`);
    parts.push(`Peta: ${g.map.caption} · ${points.join(", ")}${arrows}${sides}`);
  }
  if (g.events) parts.push(`Timeline: ${g.events.map((e) => e.date).join(" → ")}`);
  if (g.stats)
    parts.push(`Angka: ${g.stats.map((s) => `${s.prefix ?? ""}${s.value}${s.suffix ?? ""} ${s.label}`).join("; ")}`);
  if (g.comparison)
    parts.push(`Perbandingan: ${g.comparison.left} vs ${g.comparison.right} (${g.comparison.rows.length} aspek)`);
  if (g.quote) parts.push(`Kutipan: “${g.quote.text}” (${g.quote.source})`);
  if (g.chart)
    parts.push(
      `Grafik: ${g.chart.bars.map((b) => `${b.label} ${g.chart!.prefix ?? ""}${b.value}${g.chart!.suffix ?? ""}`).join("; ")}`,
    );
  if (g.profile) parts.push(`Profil: ${g.profile.name} · ${g.profile.role}`);
  if (g.timeline) parts.push(`Penanda tahun: ${g.timeline.date} · ${g.timeline.label}`);
  return parts;
}

export function SceneCard({
  scene,
  index,
  total,
  rewriting,
  locked,
}: {
  scene: Scene;
  index: number;
  total: number;
  rewriting: boolean;
  locked: boolean;
}) {
  const graphic = (scene.graphicData ?? {}) as GraphicData;
  const summary = describeGraphic(graphic);
  const disabled = rewriting || locked;

  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-500">
        <span className="font-medium text-foreground">
          Adegan {index + 1} · {visualTypeLabel[scene.visualType] ?? scene.visualType} · ±
          {formatDuration(scene.durationMs ?? 0)}
        </span>
        <div className="flex gap-1">
          <form action={moveScene.bind(null, scene.id, "up")}>
            <SubmitButton variant="secondary" size="sm" disabled={disabled || index === 0} title="Pindah ke atas">
              ↑
            </SubmitButton>
          </form>
          <form action={moveScene.bind(null, scene.id, "down")}>
            <SubmitButton
              variant="secondary"
              size="sm"
              disabled={disabled || index === total - 1}
              title="Pindah ke bawah"
            >
              ↓
            </SubmitButton>
          </form>
          <form action={addSceneAfter.bind(null, scene.id)}>
            <SubmitButton variant="secondary" size="sm" disabled={locked} title="Tambah adegan setelah ini">
              + Adegan
            </SubmitButton>
          </form>
          <form action={deleteScene.bind(null, scene.id)}>
            <SubmitButton variant="danger" size="sm" disabled={disabled || total <= 1} title="Hapus adegan">
              Hapus
            </SubmitButton>
          </form>
        </div>
      </div>

      {rewriting && <p className="mb-3 text-sm text-amber-600">Gemini sedang menulis ulang adegan ini...</p>}

      <form action={saveScene.bind(null, scene.id)} key={scene.updatedAt.toISOString()} className="space-y-3">
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Narasi
          <textarea name="narration" defaultValue={scene.narration} rows={3} className={field} disabled={disabled} />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Teks di layar
            <input name="onScreenText" defaultValue={scene.onScreenText ?? ""} className={field} disabled={disabled} />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Kata kunci aset (bahasa Inggris, pisahkan dengan koma)
            {needsAsset(scene.visualType) ? "" : " · tidak dipakai adegan grafis"}
            <input name="keywords" defaultValue={scene.keywords.join(", ")} className={field} disabled={disabled} />
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Tipe visual
            <select name="visualType" defaultValue={scene.visualType} className={field} disabled={disabled}>
              {visualTypes.map((v) => (
                <option key={v} value={v}>
                  {visualTypeLabel[v]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Suasana
            <select name="mood" defaultValue={scene.mood ?? "calm"} className={field} disabled={disabled}>
              {moods.map((m) => (
                <option key={m} value={m}>
                  {moodLabel[m]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {summary.length > 0 && (
          <div className="space-y-1 rounded-md bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            {summary.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}
        <GraphicDataField
          defaultValue={Object.keys(graphic).length ? JSON.stringify(graphic, null, 2) : ""}
          disabled={disabled}
        />

        <SubmitButton size="sm" disabled={disabled} pendingText="Menyimpan...">
          Simpan adegan
        </SubmitButton>
      </form>

      <form action={rewriteScene.bind(null, scene.id)} className="mt-3 flex gap-2">
        <input
          name="instruction"
          placeholder="Instruksi tulis ulang, misalnya: buat lebih dramatis"
          className={`${field} mt-0 flex-1`}
          disabled={disabled}
        />
        <SubmitButton variant="secondary" size="sm" disabled={disabled} pendingText="Mengirim...">
          Tulis ulang dengan Gemini
        </SubmitButton>
      </form>
    </li>
  );
}
