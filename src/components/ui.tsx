import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// Komponen tampilan bersama agar tombol, kartu, label status, dan pemberitahuan
// terlihat sama di semua halaman. Warna memakai token di app/globals.css.

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-foreground shadow-sm hover:opacity-90",
  secondary: "border border-border bg-surface text-foreground shadow-xs hover:bg-surface-muted",
  ghost: "text-muted hover:bg-surface-muted hover:text-foreground",
  danger:
    "border border-red-200 bg-surface text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40",
};

const buttonSizes: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
};

export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md") {
  return `inline-flex shrink-0 items-center justify-center rounded-lg font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${buttonVariants[variant]} ${buttonSizes[size]}`;
}

export function ButtonLink({
  variant,
  size,
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link {...props} className={`${buttonClass(variant, size)} ${className}`} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`rounded-xl border border-border bg-surface shadow-xs ${className}`} />;
}

export type Tone = "neutral" | "accent" | "info" | "success" | "warning" | "danger";

const badgeTones: Record<Tone, string> = {
  neutral: "bg-surface-muted text-muted",
  accent: "bg-accent-soft text-accent",
  info: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
};

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const noticeTones: Record<Exclude<Tone, "neutral" | "accent">, { box: string; icon: string }> = {
  info: {
    box: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200",
    icon: "i",
  },
  success: {
    box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
    icon: "✓",
  },
  warning: {
    box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    icon: "!",
  },
  danger: {
    box: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200",
    icon: "×",
  },
};

// Kotak pemberitahuan dengan judul opsional dan tombol aksi di kanan.
export function Notice({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: keyof typeof noticeTones;
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const style = noticeTones[tone];
  return (
    <div className={`flex flex-wrap items-start gap-3 rounded-xl border p-4 text-sm ${style.box}`}>
      <span
        aria-hidden
        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-bold opacity-70"
      >
        {style.icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className="leading-relaxed opacity-90">{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Judul halaman atau bagian dengan keterangan dan tombol aksi.
export function SectionHeader({
  title,
  description,
  actions,
  as: Heading = "h2",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
      <div className="min-w-0 space-y-1">
        <Heading className={Heading === "h1" ? "text-2xl font-semibold tracking-tight" : "text-lg font-semibold"}>
          {title}
        </Heading>
        {description && <p className="max-w-3xl text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-surface/60 px-6 py-12 text-center">
      <div className="font-medium">{title}</div>
      {description && <p className="max-w-md text-sm leading-relaxed text-muted">{description}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-surface-muted ${className}`}>
      <div
        className="h-full rounded-full bg-accent transition-all"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

// Label kecil di atas kolom isian.
export function FieldLabel({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-muted">
      {children}
      {hint && <span className="font-normal opacity-80"> · {hint}</span>}
    </label>
  );
}
