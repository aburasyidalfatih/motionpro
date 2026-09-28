import { connection } from "next/server";
import { db } from "@/lib/db";
import { getHealth, type Check } from "@/lib/health";
import { jobKindLabel, jobStatusLabel } from "@/lib/labels";
import { AutoRefresh } from "@/components/AutoRefresh";
import { TestJobButton } from "./TestJobButton";

async function recentJobs() {
  try {
    return await db.jobRun.findMany({ orderBy: { createdAt: "desc" }, take: 10 });
  } catch {
    return [];
  }
}

export default async function SystemPage() {
  await connection();
  const [health, jobs] = await Promise.all([getHealth(), recentJobs()]);
  const active = jobs.some((job) => job.status === "QUEUED" || job.status === "RUNNING");

  const checks: { name: string; check: Check }[] = [
    { name: "Database (PostgreSQL)", check: health.database },
    { name: "Antrian (Redis)", check: health.redis },
    { name: "Worker", check: health.worker },
  ];

  return (
    <div className="space-y-10">
      <AutoRefresh active={active} />

      <section className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold">Sistem</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Status layanan pendukung. Semua harus hijau sebelum pipeline video bisa berjalan.
          </p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-3">
          {checks.map(({ name, check }) => (
            <li
              key={name}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${check.ok ? "bg-green-500" : "bg-red-500"}`}
                  aria-hidden
                />
                {name}
              </div>
              <p className="mt-2 text-xs break-words text-zinc-600 dark:text-zinc-400">{check.detail}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Uji antrian</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Job uji melewati jalur yang sama dengan job riset, render, dan publish: web → Redis →
            worker → database.
          </p>
        </div>
        <TestJobButton />

        {jobs.length > 0 && (
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-500">
              <tr>
                <th className="py-2 font-medium">Job</th>
                <th className="py-2 font-medium">Status</th>
                <th className="py-2 font-medium">Progress</th>
                <th className="py-2 font-medium">Dibuat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {jobs.map((job) => (
                <tr key={job.id}>
                  <td className="py-2">{jobKindLabel[job.kind]}</td>
                  <td className="py-2">
                    {jobStatusLabel[job.status]}
                    {job.error && <div className="text-xs text-red-600 dark:text-red-400">{job.error}</div>}
                  </td>
                  <td className="py-2">
                    <div className="h-1.5 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800">
                      <div
                        className="h-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  </td>
                  <td className="py-2 text-zinc-500">{job.createdAt.toLocaleTimeString("id-ID")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
