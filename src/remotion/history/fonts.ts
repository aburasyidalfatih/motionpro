import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

// Font template disimpan di public/fonts (Fontsource, lisensi OFL) dan dimuat
// lokal: di Player lewat /fonts dari Next, saat render dari bundle Remotion yang
// menyalin public/. Render menunggu font lewat delayRender dan tidak butuh
// internet. Tanpa ini Chrome di worker memakai font pengganti sistem (Liberation).

const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
// Nama tempat dan tokoh berdiakritik (misalnya Łódź, Ōsaka).
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";

function load(family: string, file: string, weight: string, style = "normal") {
  // Tidak ada FontFace saat komponen Player dirender di server Next.
  if (typeof FontFace === "undefined") return;
  for (const [subset, unicodeRange] of [
    ["latin", LATIN],
    ["latin-ext", LATIN_EXT],
  ]) {
    void loadFont({ family, url: staticFile(`fonts/${file.replace("{subset}", subset)}`), weight, style, unicodeRange });
  }
}

// Judul, kutipan, dan penanda tanggal.
export const serifFamily = "Playfair Display";
load(serifFamily, "playfair-display-{subset}-wght-normal.woff2", "400 900");
load(serifFamily, "playfair-display-{subset}-wght-italic.woff2", "400 900", "italic");

// Teks kinetik, statistik, label peta, dan keterangan: kondensasi tegas khas dokumenter militer.
export const displayFamily = "Oswald";
load(displayFamily, "oswald-{subset}-wght-normal.woff2", "200 700");

// Subtitle: sans-serif lebar yang mudah dibaca di layar kecil.
export const textFamily = "Inter";
load(textFamily, "inter-{subset}-700-normal.woff2", "700");
