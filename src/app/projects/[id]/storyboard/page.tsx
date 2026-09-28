import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { pexelsEnabled } from "@/lib/assets";
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

  const withAsset = scenes.filter((s) => s.assets.some((a) => a.selected)).length;
  const unsearched = scenes.filter((s) => s.assets.length === 0).length;
  const hasFootage = scenes.some((s) => s.visualType === "footage");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {withAsset} dari {scenes.length} adegan punya aset. Klik gambar kecil untuk mengganti aset, cari ulang
          dengan kata kunci lain, atau unggah aset sendiri.
        </p>
        {unsearched > 0 && (
          <form action={startAssets.bind(null, project.id)}>
            <SubmitButton disabled={busy} pendingText="Memulai...">
              Cari aset untuk {unsearched} adegan
            </SubmitButton>
          </form>
        )}
      </div>

      {hasFootage && !pexelsEnabled() && (
        <p className="rounded-md border border-amber-300 p-3 text-sm text-amber-700 dark:border-amber-800 dark:text-amber-400">
          PEXELS_API_KEY belum diisi, jadi adegan footage memakai gambar dari Wikimedia Commons. Buat API key gratis di
          https://www.pexels.com/api untuk footage video.
        </p>
      )}

      <ol className="space-y-4">
        {scenes.map((scene, index) => (
          <SceneAssets key={scene.id} scene={scene} index={index} busy={busy} />
        ))}
      </ol>
    </div>
  );
}
