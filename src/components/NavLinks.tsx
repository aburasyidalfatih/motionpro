"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Proyek" },
  { href: "/gallery", label: "Galeri" },
  { href: "/preview", label: "Template" },
  { href: "/system", label: "Sistem" },
];

// Menu utama; halaman proyek termasuk menu "Proyek".
export function NavLinks() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" || pathname.startsWith("/projects") : pathname.startsWith(href);
  return (
    <nav className="-mx-1 flex min-w-0 gap-1 overflow-x-auto text-sm">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? "page" : undefined}
          className={`rounded-lg px-3 py-1.5 whitespace-nowrap transition ${
            isActive(item.href)
              ? "bg-surface-muted font-medium text-foreground"
              : "text-muted hover:bg-surface-muted/60 hover:text-foreground"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
