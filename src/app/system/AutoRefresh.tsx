"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Memuat ulang data server secara berkala selama masih ada job yang berjalan.
export function AutoRefresh({ active, intervalMs = 1500 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs, router]);

  return null;
}
