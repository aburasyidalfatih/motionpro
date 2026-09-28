import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { ButtonLink, EmptyState, Notice, SectionHeader } from "@/components/ui";
import type { GraphicData } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { countWords, formatDuration } from "@/lib/projects";
import { isSceneJob, type ScriptJobInput } from "@/lib/queue";
import { startGeocode, startScript } from "../actions";
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
  const rewritingIds = new Set(project.jobs.map((j) => (j.input as ScriptJobInput | null)?.sceneId).filter(Boolean));
  const scenes = project.scenes;

  if (scenes.length === 0) {
    if (busy) {
      return <EmptyState title="Menunggu tahap yang sedang berjalan selesai..." />;
    }
    if (!project.research) {
      return (
        <EmptyState
          title="Naskah ditulis dari research brief"
          description="Selesaikan riset dulu, lalu periksa brief-nya sebelum naskah ditulis."
          action={<ButtonLink href={`/projects/${project.id}/research`}>Ke tahap riset</ButtonLink>}
        />
      );
    }
    return (
      <EmptyState
        title="Naskah belum ditulis"
        description="Gemini akan menulisnya hanya dari research brief yang sudah Anda periksa, lalu memecahnya menjadi adegan."
        action={
          <form action={startScript.bind(null, project.id)}>
            <SubmitButton pendingText="Memulai...">Tulis naskah</SubmitButton>
          </form>
        }
      />
    );
  }

  const hasMaps = scenes.some((s) => (s.graphicData as GraphicData | null)?.map);
  const geocoding = project.jobs.some((j) => (j.input as ScriptJobInput | null)?.geocode);
  const totalMs = scenes.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const totalWords = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const briefChanged = project.status === "RESEARCH_READY";

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Naskah"
        description={
          <>
            {scenes.length} adegan · {totalWords} kata · perkiraan {formatDuration(totalMs)} (target{" "}
            {project.targetMinutes}:00). Durasi pasti mengikuti voice over.
            {hasMaps && " Titik peta: ✓ dari OpenStreetMap, ? tebakan AI yang perlu diperiksa."}
          </>
        }
        actions={
          <>
            {hasMaps && (
              <form action={startGeocode.bind(null, project.id)}>
                <SubmitButton
                  variant="secondary"
                  disabled={busy}
                  pendingText="Memulai..."
                  title="Cari ulang koordinat semua titik peta di OpenStreetMap"
                >
                  Cek koordinat peta
                </SubmitButton>
              </form>
            )}
            <form action={startScript.bind(null, project.id)}>
              <SubmitButton variant="secondary" disabled={busy} pendingText="Memulai...">
                Tulis ulang naskah
              </SubmitButton>
            </form>
            <ButtonLink href={`/projects/${project.id}/storyboard`}>Lanjut ke storyboard →</ButtonLink>
          </>
        }
      />

      {geocoding && <Notice tone="info">Mencari koordinat titik peta di OpenStreetMap...</Notice>}

      {briefChanged && !busy && (
        <Notice tone="warning" title="Research brief diubah setelah naskah ini ditulis">
          Tulis ulang seluruh naskah bila perubahan brief perlu masuk ke naskah.
        </Notice>
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

      <div className="flex justify-end">
        <ButtonLink href={`/projects/${project.id}/storyboard`}>Lanjut ke storyboard →</ButtonLink>
      </div>
    </div>
  );
}
