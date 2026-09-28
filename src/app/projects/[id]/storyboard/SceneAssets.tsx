import type { Asset, Scene, SceneAsset } from "@/generated/prisma/client";
import { SubmitButton } from "@/components/SubmitButton";
import { visualTypeLabel } from "@/lib/labels";
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
  if (!src) return <div className={`${className} flex items-center justify-center bg-zinc-800 text-xs text-zinc-400`}>{asset.title}</div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={asset.title ?? ""} loading="lazy" className={`${className} object-cover`} />;
}

export function SceneAssets({ scene, index, busy }: { scene: SceneWithAssets; index: number; busy: boolean }) {
  const links = [...scene.assets].sort((a, b) => a.rank - b.rank);
  const selected = links.find((l) => l.selected)?.asset;

  return (
    <li id={`adegan-${index + 1}`} className="grid gap-4 rounded-lg border border-zinc-200 p-4 md:grid-cols-[320px_1fr] dark:border-zinc-800">
      <div className="space-y-2">
        <div className="aspect-video overflow-hidden rounded-md bg-zinc-900">
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
            <div className="flex h-full items-center justify-center text-xs text-zinc-500">
              {busy ? "Mencari aset..." : "Belum ada aset"}
            </div>
          )}
        </div>
        {selected && (
          <p className="text-xs text-zinc-500">
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
        <div className="text-xs text-zinc-500">
          <span className="font-medium text-foreground">Adegan {index + 1}</span> ·{" "}
          {visualTypeLabel[scene.visualType] ?? scene.visualType}
        </div>
        <p className="text-sm">{scene.narration}</p>

        {links.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <form key={link.assetId} action={selectAsset.bind(null, scene.id, link.assetId)}>
                <button
                  type="submit"
                  title={`${link.asset.title ?? ""} · ${link.asset.license ?? ""}${link.rank >= 100 ? " · dinilai kurang relevan" : ""}`}
                  className={`block overflow-hidden rounded border-2 ${
                    link.selected
                      ? "border-zinc-900 dark:border-zinc-100"
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

        <form action={searchSceneAssets.bind(null, scene.id)} key={scene.keywords.join(",")} className="flex gap-2">
          <input
            name="query"
            defaultValue={scene.keywords.join(", ")}
            className="flex-1 rounded-md border border-zinc-300 bg-transparent px-2.5 py-1.5 text-sm dark:border-zinc-700"
            placeholder="Kata kunci bahasa Inggris, pisahkan dengan koma"
          />
          <SubmitButton variant="secondary" size="sm" disabled={busy} pendingText="Mencari...">
            Cari ulang
          </SubmitButton>
        </form>

        <form
          action={`/api/scenes/${scene.id}/upload`}
          method="post"
          encType="multipart/form-data"
          className="flex items-center gap-2 text-xs"
        >
          <input name="file" type="file" accept="image/*,video/mp4" required className="flex-1 text-xs" />
          <SubmitButton variant="secondary" size="sm" disabled={busy} pendingText="Mengunggah...">
            Unggah aset sendiri
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}
