import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { NavLinks } from "@/components/NavLinks";
import "./globals.css";

// Font antarmuka disimpan lokal (Fontsource, lisensi OFL) agar build tidak butuh internet.
const inter = localFont({
  src: "./fonts/inter-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MotionPro",
  description: "Studio produksi video motion graphic sejarah militer dan geopolitik berbasis AI",
};

// Lambang: bidikan kompas, senada dengan peta dan warna emas template video.
function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className="h-7 w-7">
      <rect width="32" height="32" rx="8" className="fill-[#14222d]" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#e0b565" strokeWidth="2" />
      <path d="M16 4.5v5M16 22.5v5M4.5 16h5M22.5 16h5" stroke="#e0b565" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.5" fill="#e0b565" />
    </svg>
  );
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:gap-8 sm:px-6">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 font-semibold tracking-tight">
              <Logo />
              <span className="hidden sm:inline">MotionPro</span>
            </Link>
            <NavLinks />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">{children}</main>
        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          MotionPro · studio video sejarah militer dan geopolitik
        </footer>
      </body>
    </html>
  );
}
