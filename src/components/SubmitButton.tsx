"use client";

import { useFormStatus } from "react-dom";

const styles = {
  primary:
    "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300",
  secondary:
    "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800",
  danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950",
};

// Tombol submit yang menampilkan status "sedang diproses" selama server action berjalan.
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  disabled,
  title,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: keyof typeof styles;
  size?: "sm" | "md";
  disabled?: boolean;
  title?: string;
}) {
  const { pending } = useFormStatus();
  const sizing = size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      type="submit"
      title={title}
      disabled={pending || disabled}
      className={`rounded-md font-medium disabled:cursor-not-allowed disabled:opacity-50 ${sizing} ${styles[variant]}`}
    >
      {pending ? (pendingText ?? "Memproses...") : children}
    </button>
  );
}
