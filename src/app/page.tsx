import Link from "next/link";
import { connection } from "next/server";
import { Badge, ButtonLink, EmptyState, SectionHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { projectStatusLabel, projectStatusTone, styleOptions } from "@/lib/labels";
import { completedStages, STAGES } from "@/lib/stages";

const styleLabel = Object.fromEntries(styleOptions.map((o) => [o.value, o.label]));

export default async function ProjectsPage() {
  await connection();
  const projects = await db.project.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div className="space-y-8">
      <SectionHeader
        as="h1"
        title="Proyek"
        description="Setiap proyek adalah satu video: dari riset topik sampai siap diunggah ke YouTube."
        actions={<ButtonLink href="/projects/new">+ Proyek baru</ButtonLink>}
      />

      {projects.length === 0 ? (
        <EmptyState
          title="Belum ada proyek"
          description="Mulai dari sebuah topik sejarah militer atau geopolitik. Gemini akan merisetnya, lalu Anda memeriksa brief sebelum naskah ditulis."
          action={<ButtonLink href="/projects/new">Buat proyek pertama</ButtonLink>}
        />
      ) : (
        <ul className="grid gap-3">
          {projects.map((project) => {
            const done = completedStages(project.status, project.failedStage);
            return (
              <li key={project.id}>
                <Link
                  href={`/projects/${project.id}`}
                  className="group flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs transition hover:border-accent/50 hover:shadow-sm sm:flex-row sm:items-center sm:p-5"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="truncate font-medium group-hover:text-accent">{project.topic}</div>
                    <div className="text-xs text-muted">
                      {project.targetMinutes} menit · {styleLabel[project.style] ?? project.style} · dibuat{" "}
                      {project.createdAt.toLocaleDateString("id-ID", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <ol className="flex items-center gap-1" aria-label="Tahap yang selesai">
                      {STAGES.map((stage, i) => (
                        <li
                          key={stage.slug}
                          title={`${stage.label}${done[i] ? " selesai" : ""}`}
                          className={`h-1.5 w-7 rounded-full ${done[i] ? "bg-accent" : "bg-surface-muted"}`}
                        />
                      ))}
                    </ol>
                    <Badge tone={projectStatusTone[project.status]} className="min-w-24 justify-center">
                      {projectStatusLabel[project.status]}
                    </Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
