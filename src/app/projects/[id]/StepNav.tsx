"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const steps = [
  { slug: "research", label: "1. Riset" },
  { slug: "script", label: "2. Naskah" },
  { slug: "storyboard", label: "3. Storyboard" },
  { slug: "audio", label: "4. Audio" },
  { slug: null, label: "5. Render", note: "Fase 3" },
];

export function StepNav({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-zinc-200 text-sm dark:border-zinc-800">
      {steps.map((step) => {
        if (!step.slug) {
          return (
            <span key={step.label} className="px-3 py-2 text-zinc-400 dark:text-zinc-600" title={`Hadir di ${step.note}`}>
              {step.label}
            </span>
          );
        }
        const href = `/projects/${projectId}/${step.slug}`;
        const active = pathname === href;
        return (
          <Link
            key={step.slug}
            href={href}
            className={`-mb-px border-b-2 px-3 py-2 ${
              active
                ? "border-zinc-900 font-medium dark:border-zinc-100"
                : "border-transparent text-zinc-600 hover:text-foreground dark:text-zinc-400"
            }`}
          >
            {step.label}
          </Link>
        );
      })}
    </nav>
  );
}
