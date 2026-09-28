"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type Step = { slug: string; label: string; done: boolean };

// Tab lima tahap produksi. Tahap yang sudah selesai diberi tanda centang.
export function StepNav({ projectId, steps }: { projectId: string; steps: Step[] }) {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ol className="flex min-w-max gap-1 rounded-xl border border-border bg-surface p-1 shadow-xs">
        {steps.map((step, i) => {
          const href = `/projects/${projectId}/${step.slug}`;
          const active = pathname === href;
          return (
            <li key={step.slug} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "step" : undefined}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition ${
                  active
                    ? "bg-brand font-medium text-brand-foreground shadow-sm"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <span
                  aria-hidden
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                    active
                      ? "bg-brand-foreground/15"
                      : step.done
                        ? "bg-accent text-brand-foreground dark:text-[#14222d]"
                        : "border border-border"
                  }`}
                >
                  {step.done ? "✓" : i + 1}
                </span>
                {step.label}
                {step.done && <span className="sr-only">(selesai)</span>}
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
