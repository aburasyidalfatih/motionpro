import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { pexelsEnabled } from "@/lib/assets";
import { needsAsset } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { isSceneJob } from "@/lib/queue";
import { startAssets } from "./actions";
import { SceneAssets } from "./SceneAssets";

async function loadProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" }, include: { assets: { include: { asset: true } } } },
      jobs: { where: { status: { in: ["QUEUED", "RUNNING"] } } },
    },
  });
}

type ProjectData = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

export default async function StoryboardPage({ params }: PageProps<"/projects/[id]/storyboard">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  return (
    <>
      <AutoRefresh active={project.jobs.length > 0} />
      <StoryboardBody project={project} />
    </>
  );
}

function StoryboardBody({ project }: { project: ProjectData }) {
  const busy = project.jobs.some((j) => !isSceneJob(j.input));
  const scenes = project.scenes;

  if (scenes.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Storyboard dibuat dari naskah.{" "}
        <Link href={`/projects/${project.id}/script`} className="underline">
          Tulis naskah dulu
        </Link>
        .
      </p>
    );
  }

  // Hanya adegan lukisan, foto arsip, dan footage yang butuh aset; adegan grafis digambar template.
  const assetScenes = scenes
    .map((scene, index) => ({ scene, index }))
    .filter(({ scene }) => needsAsset(scene.visualType));
  const graphicCount = scenes.length - assetScenes.length;
  const withAsset = assetScenes.filter(({ scene }) => scene.assets.some((a) => a.selected)).length;
  const unsearched = assetScenes.filter(({ scene }) => !scene.assets.some((a) => a.asset.provider !== "upload")).length;
  const hasFootage = assetScenes.some(({ scene }) => scene.visualType === "footage");

  const graphicNote = graphicCount > 0 && (
    <p className="rounded-md border border-zinc-200 p-3 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
      {graphicCount} adegan grafis (peta, teks kinetik, timeline, statistik, perbandingan, kutipan) digambar otomatis
      oleh template dan tidak butuh aset. Lihat hasilnya di tab{" "}
      <Link href={`/projects/${project.id}/render`} className="underline">
        Render
      </Link>
      .
    </p>
  );

  if (assetScenes.length === 0) {
    return (
      <div className="space-y-4">
        {graphicNote}
        <Link
          href={`/projects/${project.id}/audio`}
          className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Lanjut ke audio
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {graphicNote}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {withAsset} dari {assetScenes.length} adegan lukisan, arsip, dan footage punya aset. Klik gambar kecil untuk
          mengganti aset, cari ulang dengan kata kunci lain, atau unggah aset sendiri.
        </p>
        <div className="flex gap-2">
          {unsearched < assetScenes.length && (
            <form action={startAssets.bind(null, project.id, true)}>
              <SubmitButton
                variant="secondary"
                disabled={busy}
                pendingText="Memulai..."
                title="Kandidat hasil pencarian diganti; aset unggahan Anda tetap"
              >
                Cari ulang semua
              </SubmitButton>
            </form>
          )}
          {unsearched > 0 && (
            <form action={startAssets.bind(null, project.id, false)}>
              <SubmitButton disabled={busy} pendingText="Memulai...">
                Cari aset untuk {unsearched} adegan
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {hasFootage && !pexelsEnabled() && (
        <p className="rounded-md border border-amber-300 p-3 text-sm text-amber-700 dark:border-amber-800 dark:text-amber-400">
          PEXELS_API_KEY belum diisi, jadi adegan footage memakai gambar dari Wikimedia Commons. Buat API key gratis di
          https://www.pexels.com/api untuk footage video.
        </p>
      )}

      <ol className="space-y-4">
        {assetScenes.map(({ scene, index }) => (
          <SceneAssets key={scene.id} scene={scene} index={index} busy={busy} />
        ))}
      </ol>
    </div>
  );
}
