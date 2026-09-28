import Link from "next/link";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { projectStatusLabel } from "@/lib/labels";

export default async function ProjectsPage() {
  await connection();
  const projects = await db.project.findMany({ orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Proyek</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Setiap proyek adalah satu video: dari riset topik sampai siap diunggah ke YouTube.
          </p>
        </div>
        <Link
          href="/projects/new"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Proyek baru
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Belum ada proyek. Klik <span className="font-medium">Proyek baru</span> untuk mulai dari sebuah topik
          sejarah.
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/projects/${project.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div>
                  <div className="font-medium">{project.topic}</div>
                  <div className="text-xs text-zinc-500">
                    {project.targetMinutes} menit · dibuat {project.createdAt.toLocaleDateString("id-ID")}
                  </div>
                </div>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs dark:bg-zinc-800">
                  {projectStatusLabel[project.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
