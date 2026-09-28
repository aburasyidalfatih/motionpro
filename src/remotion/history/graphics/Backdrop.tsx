import { AbsoluteFill, useCurrentFrame } from "remotion";
import { theme } from "../theme";

// Latar adegan grafis: navy dengan grid peta yang bergeser perlahan, tekstur
// halus, dan vignette. Seluruhnya digambar, tanpa file gambar.
export function Backdrop() {
  const frame = useCurrentFrame();
  const shift = (frame * 0.4) % 80;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(ellipse at 50% 40%, #1a2a36 0%, ${theme.night} 75%)` }}>
      <svg width="100%" height="100%" viewBox="0 0 1920 1080" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="backdrop-grid" width="80" height="80" patternUnits="userSpaceOnUse" x={shift} y={shift / 2}>
            <path d="M80 0H0V80" fill="none" stroke={theme.grid} strokeWidth="1.5" />
          </pattern>
          <filter id="backdrop-noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.05 0" />
          </filter>
        </defs>
        <rect width="1920" height="1080" fill="url(#backdrop-grid)" />
        <rect width="1920" height="1080" filter="url(#backdrop-noise)" />
      </svg>
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)" }}
      />
    </AbsoluteFill>
  );
}

// Judul kecil di bagian atas adegan grafis (dari onScreenText).
export function Heading({ text, opacity }: { text: string; opacity: number }) {
  return (
    <div
      style={{
        position: "absolute",
        top: 72,
        left: 0,
        right: 0,
        textAlign: "center",
        fontFamily: theme.sans,
        fontSize: 40,
        fontWeight: 700,
        letterSpacing: 6,
        textTransform: "uppercase",
        color: theme.goldStrong,
        opacity,
      }}
    >
      {text}
    </div>
  );
}
