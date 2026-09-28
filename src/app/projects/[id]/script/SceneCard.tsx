import type { Scene } from "@/generated/prisma/client";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, FieldLabel } from "@/components/ui";
import { moods, needsAsset, visualTypes, type GraphicData } from "@/lib/ai/schemas";
import { moodLabel, visualTypeLabel } from "@/lib/labels";
import { formatDuration } from "@/lib/projects";
import { addSceneAfter, deleteScene, moveScene, rewriteScene, saveScene } from "../actions";
import { GraphicDataField } from "./GraphicDataField";

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
    <li className="rounded-xl border border-border bg-surface shadow-xs">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-4 py-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold tabular-nums">
          {index + 1}
        </span>
        <Badge tone={needsAsset(scene.visualType) ? "info" : "accent"}>
          {visualTypeLabel[scene.visualType] ?? scene.visualType}
        </Badge>
        <span className="text-xs text-muted">
          {moodLabel[scene.mood ?? ""] ?? "Tanpa suasana"} · ±{formatDuration(scene.durationMs ?? 0)}
        </span>
        <div className="ml-auto flex gap-1">
          <form action={moveScene.bind(null, scene.id, "up")}>
            <SubmitButton
              variant="ghost"
              size="sm"
              disabled={disabled || index === 0}
              title="Pindah ke atas"
              pendingText="…"
            >
              ↑
            </SubmitButton>
          </form>
          <form action={moveScene.bind(null, scene.id, "down")}>
            <SubmitButton
              variant="ghost"
              size="sm"
              disabled={disabled || index === total - 1}
              title="Pindah ke bawah"
              pendingText="…"
            >
              ↓
            </SubmitButton>
          </form>
          <form action={addSceneAfter.bind(null, scene.id)}>
            <SubmitButton variant="ghost" size="sm" disabled={locked} title="Tambah adegan setelah ini" pendingText="…">
              + Adegan
            </SubmitButton>
          </form>
          <form action={deleteScene.bind(null, scene.id)}>
            <SubmitButton
              variant="ghost"
              size="sm"
              disabled={disabled || total <= 1}
              title="Hapus adegan"
              pendingText="…"
            >
              <span className="text-red-600 dark:text-red-400">Hapus</span>
            </SubmitButton>
          </form>
        </div>
      </div>

      <div className="space-y-3 px-4 py-4">
        {rewriting && (
          <p className="flex items-center gap-2 text-sm text-accent">
            <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
            Gemini sedang menulis ulang adegan ini...
          </p>
        )}
        <p className="text-[15px] leading-relaxed">{scene.narration}</p>
        {scene.onScreenText && (
          <p className="text-xs text-muted">
            Teks di layar: <span className="text-foreground">“{scene.onScreenText}”</span>
          </p>
        )}
        {summary.length > 0 && (
          <div className="space-y-1 rounded-lg bg-surface-muted px-3 py-2 text-xs text-muted">
            {summary.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        )}
      </div>

      <details className="group border-t border-border">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-xs font-medium text-muted select-none hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="transition group-open:rotate-90" aria-hidden>
            ›
          </span>
          Edit adegan atau tulis ulang dengan Gemini
        </summary>
        <div className="space-y-5 px-4 pt-1 pb-4">
          <form action={saveScene.bind(null, scene.id)} key={scene.updatedAt.toISOString()} className="space-y-4">
            <div>
              <FieldLabel htmlFor={`narration-${scene.id}`}>Narasi</FieldLabel>
              <textarea
                id={`narration-${scene.id}`}
                name="narration"
                defaultValue={scene.narration}
                rows={4}
                className="field"
                disabled={disabled}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor={`screen-${scene.id}`}>Teks di layar</FieldLabel>
                <input
                  id={`screen-${scene.id}`}
                  name="onScreenText"
                  defaultValue={scene.onScreenText ?? ""}
                  className="field"
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel
                  htmlFor={`keywords-${scene.id}`}
                  hint={
                    needsAsset(scene.visualType)
                      ? "bahasa Inggris, pisahkan dengan koma"
                      : "tidak dipakai adegan grafis"
                  }
                >
                  Kata kunci aset
                </FieldLabel>
                <input
                  id={`keywords-${scene.id}`}
                  name="keywords"
                  defaultValue={scene.keywords.join(", ")}
                  className="field"
                  disabled={disabled}
                />
              </div>
              <div>
                <FieldLabel htmlFor={`type-${scene.id}`}>Tipe visual</FieldLabel>
                <select
                  id={`type-${scene.id}`}
                  name="visualType"
                  defaultValue={scene.visualType}
                  className="field"
                  disabled={disabled}
                >
                  {visualTypes.map((v) => (
                    <option key={v} value={v}>
                      {visualTypeLabel[v]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel htmlFor={`mood-${scene.id}`}>Suasana</FieldLabel>
                <select
                  id={`mood-${scene.id}`}
                  name="mood"
                  defaultValue={scene.mood ?? "calm"}
                  className="field"
                  disabled={disabled}
                >
                  {moods.map((m) => (
                    <option key={m} value={m}>
                      {moodLabel[m]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <GraphicDataField
              defaultValue={Object.keys(graphic).length ? JSON.stringify(graphic, null, 2) : ""}
              disabled={disabled}
            />
            <SubmitButton disabled={disabled} pendingText="Menyimpan...">
              Simpan adegan
            </SubmitButton>
          </form>

          <form action={rewriteScene.bind(null, scene.id)} className="space-y-2 border-t border-border pt-4">
            <FieldLabel htmlFor={`rewrite-${scene.id}`}>Tulis ulang dengan Gemini</FieldLabel>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={`rewrite-${scene.id}`}
                name="instruction"
                placeholder="Instruksi, misalnya: buat lebih dramatis"
                className="field"
                disabled={disabled}
              />
              <SubmitButton variant="secondary" disabled={disabled} pendingText="Mengirim...">
                Tulis ulang
              </SubmitButton>
            </div>
          </form>
        </div>
      </details>
    </li>
  );
}
