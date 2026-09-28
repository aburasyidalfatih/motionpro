import { notFound } from "next/navigation";
import { connection } from "next/server";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { jobKindLabel, projectStatusLabel } from "@/lib/labels";
import { isSceneJob } from "@/lib/queue";
import { retryFailedStage } from "./actions";
import { StepNav } from "./StepNav";

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{project.topic}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {project.targetMinutes} menit · {project.language === "en" ? "English" : "Bahasa Indonesia"} ·{" "}
            gaya {project.tone}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800">
          {projectStatusLabel[project.status]}
        </span>
      </div>

      <StepNav projectId={project.id} />

      {stageJob && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {jobKindLabel[stageJob.kind]} {stageJob.status === "QUEUED" ? "menunggu antrian" : "sedang berjalan"}
            </span>
            <span className="text-zinc-500">{stageJob.progress}%</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-1.5 rounded-full bg-zinc-900 transition-all dark:bg-zinc-100"
              style={{ width: `${stageJob.progress}%` }}
            />
          </div>
          {stageJob.error && <p className="mt-2 text-xs text-amber-600">{stageJob.error}</p>}
        </div>
      )}

      {project.status === "FAILED" && !stageJob && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 p-4 text-sm dark:border-red-900">
          <div>
            <div className="font-medium text-red-700 dark:text-red-400">
              Tahap {project.failedStage ? jobKindLabel[project.failedStage] : ""} gagal
            </div>
            {failedJob?.error && <p className="mt-1 text-zinc-600 dark:text-zinc-400">{failedJob.error}</p>}
          </div>
          <form action={retryFailedStage.bind(null, project.id)}>
            <SubmitButton pendingText="Mengulang...">Coba lagi</SubmitButton>
          </form>
        </div>
      )}

      {children}
    </div>
  );
}
