import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { ButtonLink, EmptyState, Notice, SectionHeader } from "@/components/ui";
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
      <EmptyState
        title="Storyboard dibuat dari naskah"
        description="Setelah naskah ditulis, adegan lukisan, foto arsip, dan footage mendapat aset di sini."
        action={<ButtonLink href={`/projects/${project.id}/script`}>Ke tahap naskah</ButtonLink>}
      />
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
  const next = <ButtonLink href={`/projects/${project.id}/audio`}>Lanjut ke audio →</ButtonLink>;

  const graphicNote = graphicCount > 0 && (
    <Notice tone="info">
      {graphicCount} adegan grafis (peta, teks kinetik, timeline, statistik, perbandingan, kutipan) digambar otomatis
      oleh template dan tidak butuh aset. Lihat hasilnya di tab{" "}
      <Link href={`/projects/${project.id}/render`} className="font-medium underline underline-offset-2">
        Render
      </Link>
      .
    </Notice>
  );

  if (assetScenes.length === 0) {
    return (
      <div className="space-y-6">
        <SectionHeader
          title="Storyboard"
          description="Semua adegan proyek ini grafis, jadi tidak ada aset yang perlu dicari."
          actions={next}
        />
        {graphicNote}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Storyboard"
        description={`${withAsset} dari ${assetScenes.length} adegan lukisan, arsip, dan footage punya aset. Klik gambar kecil untuk mengganti aset, cari ulang dengan kata kunci lain, atau unggah aset sendiri.`}
        actions={
          <>
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
            {unsearched > 0 ? (
              <form action={startAssets.bind(null, project.id, false)}>
                <SubmitButton disabled={busy} pendingText="Memulai...">
                  Cari aset untuk {unsearched} adegan
                </SubmitButton>
              </form>
            ) : (
              next
            )}
          </>
        }
      />

      {graphicNote}

      {hasFootage && !pexelsEnabled() && (
        <Notice tone="warning" title="PEXELS_API_KEY belum diisi">
          Adegan footage memakai gambar dari Wikimedia Commons. Buat API key gratis di{" "}
          <a href="https://www.pexels.com/api" target="_blank" rel="noreferrer" className="underline">
            pexels.com/api
          </a>{" "}
          untuk footage video.
        </Notice>
      )}

      <ol className="space-y-4">
        {assetScenes.map(({ scene, index }) => (
          <SceneAssets key={scene.id} scene={scene} index={index} busy={busy} />
        ))}
      </ol>
    </div>
  );
}
