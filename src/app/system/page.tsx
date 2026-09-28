import { connection } from "next/server";
import { db } from "@/lib/db";
import { getHealth, type Check } from "@/lib/health";
import { jobKindLabel, jobStatusLabel } from "@/lib/labels";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Badge, Card, ProgressBar, SectionHeader } from "@/components/ui";
import { TestJobButton } from "./TestJobButton";

const jobStatusTone = { QUEUED: "neutral", RUNNING: "accent", SUCCEEDED: "success", FAILED: "danger" } as const;

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
        <SectionHeader
          as="h1"
          title="Sistem"
          description="Status layanan pendukung. Semua harus hijau sebelum pipeline video bisa berjalan."
        />
        <ul className="grid gap-3 sm:grid-cols-3">
          {checks.map(({ name, check }) => (
            <li key={name}>
              <Card className="h-full p-4">
                <div className="flex items-center justify-between gap-2 text-sm font-medium">
                  {name}
                  <Badge tone={check.ok ? "success" : "danger"}>{check.ok ? "Aktif" : "Bermasalah"}</Badge>
                </div>
                <p className="mt-2 text-xs break-words text-muted">{check.detail}</p>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Uji antrian"
          description="Job uji melewati jalur yang sama dengan job riset, render, dan publish: web → Redis → worker → database."
          actions={<TestJobButton />}
        />

        {jobs.length > 0 && (
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Job</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium">Progress</th>
                  <th className="px-4 py-2.5 font-medium">Dibuat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-2.5">{jobKindLabel[job.kind]}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={jobStatusTone[job.status]}>{jobStatusLabel[job.status]}</Badge>
                      {job.error && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{job.error}</div>}
                    </td>
                    <td className="px-4 py-2.5">
                      <ProgressBar value={job.progress} className="w-32" />
                    </td>
                    <td className="px-4 py-2.5 text-muted tabular-nums">{job.createdAt.toLocaleTimeString("id-ID")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>
    </div>
  );
}
