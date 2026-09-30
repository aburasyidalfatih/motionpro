"use client";

import Link from "next/link";
import { pacingIssues } from "@/remotion/history/pacing";
import type { HistoryVideoProps } from "@/remotion/history/types";

// Pemeriksaan ritme video sebelum render (lihat remotion/history/pacing.ts).
export function PacingCheck({ props, projectId }: { props: HistoryVideoProps; projectId: string }) {
  const issues = pacingIssues(props);
  if (issues.length === 0) {
    return (
      <p className="text-sm text-emerald-700 dark:text-emerald-400">
        Ritme visual baik: tidak ada bagian yang diam terlalu lama.
      </p>
    );
  }
  return (
    <div className="space-y-2 rounded-md border border-amber-300 p-3 text-sm dark:border-amber-800">
      <p className="font-medium text-amber-700 dark:text-amber-400">
        {issues.length} catatan ritme. Perbaiki di{" "}
        <Link href={`/projects/${projectId}/script`} className="underline">
          tab Naskah
        </Link>{" "}
        agar video tidak terasa lambat.
      </p>
      <ul className="list-disc space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
        {issues.slice(0, 12).map((issue, i) => (
          <li key={i}>
            {issue.scene >= 0 ? `Adegan ${issue.scene + 1}: ` : ""}
            {issue.message}
          </li>
        ))}
      </ul>
      {issues.length > 12 && <p className="text-xs text-zinc-500">dan {issues.length - 12} catatan lain.</p>}
    </div>
  );
}
