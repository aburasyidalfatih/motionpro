import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { countWords, formatDuration } from "@/lib/projects";
import { isSceneJob, type ScriptJobInput } from "@/lib/queue";
import { startScript } from "../actions";
import { SceneCard } from "./SceneCard";

async function loadProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" } },
      research: { select: { id: true, updatedAt: true } },
      jobs: { where: { status: { in: ["QUEUED", "RUNNING"] } } },
    },
  });
}

type ProjectData = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

export default async function ScriptPage({ params }: PageProps<"/projects/[id]/script">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  // Polling ada di halaman, bukan di layout: layout tidak di-render ulang saat
  // berpindah tab di dalam proyek yang sama.
  return (
    <>
      <AutoRefresh active={project.jobs.length > 0} />
      <ScriptBody project={project} />
    </>
  );
}

function ScriptBody({ project }: { project: ProjectData }) {
  const busy = project.jobs.some((j) => !isSceneJob(j.input));
  const rewritingIds = new Set(
    project.jobs.map((j) => (j.input as ScriptJobInput | null)?.sceneId).filter(Boolean),
  );
  const scenes = project.scenes;

  if (scenes.length === 0) {
    if (busy) {
      return <p className="text-sm text-zinc-600 dark:text-zinc-400">Menunggu tahap yang sedang berjalan selesai...</p>;
    }
    if (!project.research) {
      return (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Naskah ditulis dari research brief.{" "}
          <Link href={`/projects/${project.id}/research`} className="underline">
            Selesaikan riset dulu
          </Link>
          .
        </p>
      );
    }
    return (
      <form action={startScript.bind(null, project.id)} className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Naskah belum ditulis. Gemini akan menulisnya hanya dari research brief yang sudah Anda periksa.
        </p>
        <SubmitButton pendingText="Memulai...">Tulis naskah</SubmitButton>
      </form>
    );
  }

  const totalMs = scenes.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const briefChanged = project.status === "RESEARCH_READY";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {scenes.length} adegan · {totalWords} kata · perkiraan durasi {formatDuration(totalMs)} (target{" "}
          {project.targetMinutes}:00). Durasi pasti mengikuti voice over di Fase 2.
        </p>
        <div className="flex gap-2">
          <form action={startScript.bind(null, project.id)}>
            <SubmitButton variant="secondary" disabled={busy} pendingText="Memulai...">
              Tulis ulang seluruh naskah
            </SubmitButton>
          </form>
          <Link
            href={`/projects/${project.id}/storyboard`}
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Lanjut ke storyboard
          </Link>
        </div>
      </div>

      {briefChanged && !busy && (
        <p className="rounded-md border border-amber-300 p-3 text-sm text-amber-700 dark:border-amber-800 dark:text-amber-400">
          Research brief diubah setelah naskah ini ditulis. Tulis ulang seluruh naskah bila perubahan brief perlu
          masuk ke naskah.
        </p>
      )}

      <ol className="space-y-4">
        {scenes.map((scene, index) => (
          <SceneCard
            key={scene.id}
            scene={scene}
            index={index}
            total={scenes.length}
            rewriting={rewritingIds.has(scene.id)}
            locked={busy}
          />
        ))}
      </ol>
    </div>
  );
}
