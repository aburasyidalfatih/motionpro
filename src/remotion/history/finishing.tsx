import { lightLeak } from "@remotion/effects/light-leak";
import { useSyncExternalStore } from "react";
import { AbsoluteFill, interpolate, random, Solid, useCurrentFrame, useVideoConfig } from "remotion";

// Lapisan akhir ("finishing") di atas seluruh video, seperti grading di
// editor profesional: butiran film, vignette, dan kilatan cahaya (light leak)
// saat kartu judul dan bab muncul. Light leak memakai WebGL2 dari @remotion/effects.

const GRAIN_TILE = 256;
const GRAIN_TILES = 4;

// Tekstur butiran abu-abu acak, dibuat sekali. Memakai random() Remotion
// dengan seed tetap agar sama di semua tab render yang berjalan paralel.
function grainTiles() {
  return Array.from({ length: GRAIN_TILES }, (_, t) => {
    const canvas = document.createElement("canvas");
    canvas.width = GRAIN_TILE;
    canvas.height = GRAIN_TILE;
    const context = canvas.getContext("2d");
    if (!context) return "";
    const image = context.createImageData(GRAIN_TILE, GRAIN_TILE);
    for (let i = 0; i < GRAIN_TILE * GRAIN_TILE; i++) {
      const value = Math.round(random(`grain-${t}-${i}`) * 255);
      image.data.set([value, value, value, 255], i * 4);
    }
    context.putImageData(image, 0, 0);
    return canvas.toDataURL("image/png");
  });
}

let cachedTiles: string[] | undefined;
const NO_TILES: string[] = [];
const noSubscription = () => () => {};
const clientTiles = () => (cachedTiles ??= grainTiles());
const serverTiles = () => NO_TILES;

// Butiran film yang berganti tiap frame: tekstur yang sama digeser acak, dengan
// mode blend overlay sehingga hanya variasi butirannya yang terlihat. Jauh
// lebih ringan daripada menghitung noise baru tiap frame.
export function FilmGrain({ strength = 0.09 }: { strength?: number }) {
  const frame = useCurrentFrame();
  // Tekstur hanya dibuat di browser: saat render server Next.js dan hydration
  // hasilnya kosong, jadi HTML server dan browser sama.
  const tiles = useSyncExternalStore(noSubscription, clientTiles, serverTiles);
  if (tiles.length === 0) return null;
  const x = Math.floor(random(`grain-x-${frame}`) * GRAIN_TILE);
  const y = Math.floor(random(`grain-y-${frame}`) * GRAIN_TILE);
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: `url(${tiles[frame % tiles.length]})`,
        backgroundSize: `${GRAIN_TILE}px ${GRAIN_TILE}px`,
        backgroundPosition: `${x}px ${y}px`,
        mixBlendMode: "overlay",
        opacity: strength,
      }}
    />
  );
}

// Vignette dan sedikit kontras hangat yang menyatukan warna semua adegan.
export function GradeOverlay() {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(0,0,0,0.38) 100%), linear-gradient(180deg, rgba(255,190,110,0.03), rgba(20,40,60,0.05))",
      }}
    />
  );
}

// Filter warna untuk seluruh gambar (dipasang pada wadah semua adegan).
export const GRADE_FILTER = "contrast(1.06) saturate(1.04)";

// Kilatan cahaya hangat yang mengembang lalu surut, dengan pola berbeda per seed.
export function LightLeakFlash({ seed }: { seed: number }) {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  return (
    <Solid
      width={width}
      height={height}
      effects={[
        lightLeak({
          seed,
          hueShift: 12,
          progress: interpolate(frame, [0, durationInFrames - 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }),
      ]}
      style={{ position: "absolute", inset: 0, mixBlendMode: "screen", opacity: 0.55, pointerEvents: "none" }}
    />
  );
}
