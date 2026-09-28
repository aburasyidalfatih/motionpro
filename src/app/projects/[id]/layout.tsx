import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, Card, Notice, ProgressBar } from "@/components/ui";
import { db } from "@/lib/db";
import { jobKindLabel, projectStatusLabel, projectStatusTone, styleOptions } from "@/lib/labels";
import { isSceneJob } from "@/lib/queue";
import { completedStages, STAGES } from "@/lib/stages";
import { retryFailedStage } from "./actions";
import { StepNav } from "./StepNav";

const styleLabel = Object.fromEntries(styleOptions.map((o) => [o.value, o.label]));

export default async function ProjectLayout({ children, params }: LayoutProps<"/projects/[id]">) {
  await connection();
  const { id } = await params;
  const project = await db.project.findUnique({
    where: { id },
    include: { jobs: { orderBy: { createdAt: "desc" }, take: 20 } },
  });
  if (!project) notFound();

  const activeJobs = project.jobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING");
  const stageJob = activeJobs.find((j) => !isSceneJob(j.input));
  const failedJob =
    project.status === "FAILED"
      ? project.jobs.find((j) => j.status === "FAILED" && j.kind === project.failedStage)
      : undefined;
  const done = completedStages(project.status, project.failedStage);
  const steps = STAGES.map((stage, i) => ({ slug: stage.slug, label: stage.label, done: done[i] }));

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Link href="/" className="text-xs text-muted hover:text-foreground">
          ← Semua proyek
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-balance">{project.topic}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>{project.targetMinutes} menit</span>
              <span aria-hidden>·</span>
              <span>{project.language === "en" ? "English" : "Bahasa Indonesia"}</span>
              <span aria-hidden>·</span>
              <span>Gaya {project.tone}</span>
              <span aria-hidden>·</span>
              <span>{styleLabel[project.style] ?? project.style}</span>
            </div>
          </div>
          <Badge tone={projectStatusTone[project.status]}>{projectStatusLabel[project.status]}</Badge>
        </div>
      </div>

      <StepNav projectId={project.id} steps={steps} />

      {stageJob && (
        <Card className="space-y-2.5 p-4">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
              {jobKindLabel[stageJob.kind]} {stageJob.status === "QUEUED" ? "menunggu antrian" : "sedang berjalan"}
            </span>
            <span className="text-muted tabular-nums">{stageJob.progress}%</span>
          </div>
          <ProgressBar value={stageJob.progress} />
          {stageJob.error && <p className="text-xs text-amber-700 dark:text-amber-400">{stageJob.error}</p>}
        </Card>
      )}

      {project.status === "FAILED" && !stageJob && (
        <Notice
          tone="danger"
          title={`Tahap ${project.failedStage ? jobKindLabel[project.failedStage] : ""} gagal`}
          action={
            <form action={retryFailedStage.bind(null, project.id)}>
              <SubmitButton pendingText="Mengulang...">Coba lagi</SubmitButton>
            </form>
          }
        >
          {failedJob?.error}
        </Notice>
      )}

      <div>{children}</div>
    </div>
  );
}
