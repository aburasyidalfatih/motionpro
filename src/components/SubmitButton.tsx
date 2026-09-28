"use client";

import { useFormStatus } from "react-dom";
import { buttonClass, type ButtonSize, type ButtonVariant } from "./ui";

// Tombol submit yang menampilkan status "sedang diproses" selama server action berjalan.
export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "md",
  disabled,
  title,
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  title?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      title={title}
      disabled={pending || disabled}
      className={`${buttonClass(variant, size)} ${className}`}
    >
      {pending && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
        />
      )}
      {pending ? (pendingText ?? "Memproses...") : children}
    </button>
  );
}
