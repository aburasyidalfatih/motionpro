import type { Asset, JobRun, Scene, SceneAsset } from "@/generated/prisma/client";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge } from "@/components/ui";
import { visualTypeLabel } from "@/lib/labels";
import type { AssetJobInput, AssetSearchResult } from "@/lib/queue";
import { fileUrl } from "@/lib/storage";
import { searchSceneAssets, selectAsset } from "./actions";

type SceneWithAssets = Scene & { assets: (SceneAsset & { asset: Asset })[] };

function imageSrc(asset: Asset) {
  if (asset.localPath && asset.kind === "IMAGE") return fileUrl(asset.localPath);
  return asset.previewUrl;
}

// Gambar dari penyimpanan lokal atau sumber eksternal; ukurannya tidak diketahui
// sebelumnya, jadi memakai <img> biasa, bukan next/image.
function Thumb({ asset, className }: { asset: Asset; className: string }) {
  const src = imageSrc(asset);
  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-surface-muted p-1 text-center text-[10px] leading-tight text-muted`}
      >
        {asset.title}
      </div>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={asset.title ?? ""} loading="lazy" className={`${className} object-cover`} />;
}

// Pesan status pencarian/unduhan terakhir adegan ini; tanpa ini tombol "Cari
// ulang" terlihat tidak bereaksi karena pekerjaannya berjalan di worker.
function jobStatus(job: JobRun | undefined, hasCandidates: boolean, hasSelection: boolean) {
  if (!job) return null;
  const input = (job.input ?? {}) as AssetJobInput;
  const action = input.downloadOnly ? "Mengunduh aset" : "Mencari aset";
  if (job.status === "QUEUED" || job.status === "RUNNING") {
    return { tone: "busy" as const, text: `${action}...${job.error ? ` (${job.error})` : ""}` };
  }
  if (job.status === "FAILED") {
    return {
      tone: "error" as const,
      text: `${input.downloadOnly ? "Unduhan" : "Pencarian"} gagal: ${job.error ?? "tanpa keterangan"}`,
    };
  }
  const result = job.result as AssetSearchResult | null;
  if (input.downloadOnly || !result || typeof result.found !== "number") return null;
  if (result.found === 0) {
    return {
      tone: "warning" as const,
      text: 'Tidak ada hasil untuk kata kunci ini; kandidat lama dipertahankan. Coba kata kunci yang lebih pendek dan umum, misalnya nama tokoh, kerajaan, atau "javanese painting".',
    };
  }
  if (!hasSelection && hasCandidates) {
    return {
      tone: "warning" as const,
      text: `${result.found} kandidat ditemukan, tapi tidak ada yang dinilai cocok dengan narasi. Klik gambar kecil untuk memakainya, atau cari dengan kata kunci lain.`,
    };
  }
  return { tone: "ok" as const, text: `${result.found} kandidat ditemukan, ${result.relevant ?? 0} dinilai cocok.` };
}

const statusStyle = {
  busy: "text-accent",
  ok: "text-muted",
  warning: "text-amber-700 dark:text-amber-400",
  error: "text-red-700 dark:text-red-400",
};

export function SceneAssets({
  scene,
  index,
  busy,
  job,
}: {
  scene: SceneWithAssets;
  index: number;
  busy: boolean;
  job?: JobRun;
}) {
  const links = [...scene.assets].sort((a, b) => a.rank - b.rank);
  const selected = links.find((l) => l.selected)?.asset;
  const status = jobStatus(job, links.length > 0, Boolean(selected));
  const searching = status?.tone === "busy";

  return (
    <li
      id={`adegan-${index + 1}`}
      className="grid gap-5 rounded-xl border border-border bg-surface p-4 shadow-xs md:grid-cols-[320px_1fr]"
    >
      <div className="space-y-2">
        <div className="aspect-video overflow-hidden rounded-lg bg-[#0b131a]">
          {selected ? (
            selected.kind === "VIDEO" && selected.localPath ? (
              <video
                src={fileUrl(selected.localPath)}
                poster={selected.previewUrl ?? undefined}
                muted
                controls
                preload="none"
                className="h-full w-full object-cover"
              />
            ) : (
              <Thumb asset={selected} className="h-full w-full" />
            )
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-xs leading-relaxed text-[#9fb0bf]">
              {busy || searching
                ? "Mencari aset..."
                : links.length > 0
                  ? "Belum ada aset terpilih. Klik salah satu gambar kecil di samping untuk memakainya."
                  : "Belum ada aset"}
            </div>
          )}
        </div>
        {selected && (
          <p className="text-xs leading-relaxed text-muted">
            {selected.pageUrl ? (
              <a href={selected.pageUrl} target="_blank" rel="noreferrer" className="underline">
                {selected.title}
              </a>
            ) : (
              selected.title
            )}
            {selected.author && ` · ${selected.author}`} · {selected.license}
            {selected.kind === "VIDEO" && " · video"}
            {!selected.localPath && " · sedang diunduh"}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-muted text-xs font-semibold">
            {index + 1}
          </span>
          <Badge tone="info">{visualTypeLabel[scene.visualType] ?? scene.visualType}</Badge>
        </div>
        <p className="text-sm leading-relaxed">{scene.narration}</p>

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <form key={link.assetId} action={selectAsset.bind(null, scene.id, link.assetId)}>
                <button
                  type="submit"
                  title={`${link.asset.title ?? ""} · ${link.asset.license ?? ""}${link.rank >= 100 ? " · dinilai kurang relevan" : ""}`}
                  className={`block overflow-hidden rounded-md border-2 transition ${
                    link.selected
                      ? "border-accent"
                      : link.rank >= 100
                        ? "border-transparent opacity-30 hover:opacity-100"
                        : "border-transparent opacity-80 hover:opacity-100"
                  }`}
                >
                  <Thumb asset={link.asset} className="h-14 w-24" />
                </button>
              </form>
            ))}
          </div>
        )}

        {status && (
          <p className={`flex items-start gap-2 text-xs leading-relaxed ${statusStyle[status.tone]}`} role="status">
            {status.tone === "busy" && (
              <span
                aria-hidden
                className="mt-0.5 h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent"
              />
            )}
            {status.text}
          </p>
        )}

        <form action={searchSceneAssets.bind(null, scene.id)} key={scene.keywords.join(",")} className="flex gap-2">
          <input
            name="query"
            defaultValue={scene.keywords.join(", ")}
            className="field h-8 flex-1 py-1"
            placeholder="Kata kunci bahasa Inggris, pisahkan dengan koma"
          />
          <SubmitButton variant="secondary" size="sm" disabled={busy || searching} pendingText="Mengirim...">
            {searching ? "Mencari..." : "Cari ulang"}
          </SubmitButton>
        </form>

        <form
          action={`/api/scenes/${scene.id}/upload`}
          method="post"
          encType="multipart/form-data"
          className="flex items-center gap-2 text-xs"
        >
          <input
            name="file"
            type="file"
            accept="image/*,video/mp4"
            required
            aria-label="File gambar atau video MP4"
            className="min-w-0 flex-1 text-xs text-muted file:mr-3 file:h-8 file:cursor-pointer file:rounded-lg file:border file:border-border file:bg-surface file:px-3 file:text-xs file:font-medium file:text-foreground hover:file:bg-surface-muted"
          />
          <SubmitButton variant="secondary" size="sm" disabled={busy} pendingText="Mengunggah...">
            Unggah aset sendiri
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
