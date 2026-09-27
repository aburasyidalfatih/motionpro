import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotionPro",
  description: "Studio produksi video motion graphic sejarah berbasis AI",
};

const nav = [
  { href: "/", label: "Proyek" },
  { href: "/preview", label: "Pratinjau template" },
  { href: "/system", label: "Sistem" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="border-b border-zinc-200 dark:border-zinc-800">
          <div className="mx-auto flex max-w-5xl items-center gap-8 px-6 py-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              MotionPro
            </Link>
            <nav className="flex gap-6 text-sm text-zinc-600 dark:text-zinc-400">
              {nav.map((item) => (
                <Link key={item.href} href={item.href} className="hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
