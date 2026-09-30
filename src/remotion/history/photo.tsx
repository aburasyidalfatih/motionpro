import { AbsoluteFill, Easing, Img, interpolate, random, useCurrentFrame, useVideoConfig } from "remotion";
import { useBeats } from "./beats";
import { theme } from "./theme";
import type { Box, SceneAssetProps } from "./types";

// Lukisan, foto arsip, dan ilustrasi seperti di dokumenter profesional:
// kamera tidak bergerak acak, tetapi mendekati subjek utama lalu berpindah ke
// subjek yang sedang disebut narator, yang diberi sorotan (spotlight dan
// label). Posisi subjek dari analisis Gemini vision (lib/assets/analyze.ts);
// tanpa analisis, ken-burns biasa. Tampilan era menyatukan warna semua gambar.

const W = 1920;
const H = 1080;

// Tampilan per jenis gambar:
// - archival: foto hitam-putih/sepia dan footage sebelum 1950, dengan kerusakan film;
// - muted: foto berwarna dan footage modern, warnanya diredam agar selaras;
// - painting: lukisan dan ilustrasi AI, hangat dan sedikit kontras.
export type Look = "archival" | "muted" | "painting";

export const LOOK_FILTERS: Record<Look, string> = {
  archival: "grayscale(1) sepia(0.32) contrast(1.16) brightness(0.93)",
  muted: "saturate(0.72) sepia(0.14) contrast(1.06) brightness(0.97)",
  painting: "saturate(0.95) sepia(0.06) contrast(1.05)",
};

export function lookFor(visualType: string, asset: SceneAssetProps, eraYear: number | null): Look {
  if (visualType === "painting" || visualType === "illustration") return "painting";
  if (visualType === "archival_photo") return asset.monochrome === false ? "muted" : "archival";
  // Footage (dan tipe lain): era cerita sebelum 1950 tampil seperti film lama.
  return eraYear !== null && eraYear < 1950 ? "archival" : "muted";
}

// Kerusakan film lama: goresan vertikal yang muncul sesaat, debu, kedip cahaya,
// dan tepi gelap. Acak tetapi tetap sama di semua tab render (random() Remotion).
export function FilmDamage({ seed }: { seed: string }) {
  const frame = useCurrentFrame();
  const r = (k: string) => random(`${seed}-${frame}-${k}`);
  const flicker = 0.05 + r("flicker") * 0.07;
  const scratches = Array.from({ length: 2 }, (_, i) => ({
    show: r(`s${i}`) < 0.35,
    x: r(`sx${i}`) * W,
    opacity: 0.25 + r(`so${i}`) * 0.35,
  }));
  const dust = Array.from({ length: 10 }, (_, i) => ({
    x: r(`dx${i}`) * W,
    y: r(`dy${i}`) * H,
    r: 1 + r(`dr${i}`) * 3.5,
    dark: r(`dd${i}`) < 0.6,
  }));
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <AbsoluteFill style={{ backgroundColor: "#000", opacity: flicker }} />
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0 }}>
        {scratches.map((s, i) =>
          s.show ? (
            <line key={i} x1={s.x} y1={0} x2={s.x + 6} y2={H} stroke="#f3ead8" strokeWidth={1.5} opacity={s.opacity} />
          ) : null,
        )}
        {dust.map((d, i) => (
          <circle key={i} cx={d.x} cy={d.y} r={d.r} fill={d.dark ? "#120c06" : "#efe6d2"} opacity={0.55} />
        ))}
      </svg>
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, transparent 58%, rgba(10,6,2,0.55) 100%)" }}
      />
    </AbsoluteFill>
  );
}

type Camera = { s: number; cx: number; cy: number };

// Ukuran tampil gambar: lanskap memenuhi layar (cover); potret atau persegi
// tampil utuh (contain) di atas latar buram dari gambar yang sama.
function layout(asset: SceneAssetProps) {
  const aspect = asset.width && asset.height ? asset.width / asset.height : 16 / 9;
  const cover = aspect >= 1.3;
  const wide = aspect > W / H;
  const dispW = cover ? (wide ? H * aspect : W) : wide ? W : H * aspect;
  const dispH = cover ? (wide ? H : W / aspect) : wide ? W / aspect : H;
  return { cover, dispW, dispH, ox: (W - dispW) / 2, oy: (H - dispH) / 2 };
}

const MOVE_FRAMES = 30;

// Ken-burns lama untuk gambar tanpa analisis: arah bergantian per adegan.
function fallbackCamera(variant: number, t: number): Camera {
  const zoomIn = variant % 2 === 0;
  const s = zoomIn ? 1.04 + t * 0.12 : 1.16 - t * 0.12;
  const dx = [-1, 1, 0, 1, -1][variant % 5] * 0.025 * W * (t - 0.5);
  const dy = [0, -1, 1, 1, -1][variant % 5] * 0.015 * H * (t - 0.5);
  return { s, cx: W / 2 - dx, cy: H / 2 - dy };
}

// Geser agar titik (cx, cy) di tengah layar. Gambar cover dibatasi agar tepinya
// tidak terlihat; gambar contain (lebih kecil dari layar pada satu sumbu) boleh
// bergeser selama tetap utuh di layar.
function translate(camera: Camera, l: ReturnType<typeof layout>) {
  const axis = (c: number, size: number, offset: number, disp: number) => {
    const lo = size / 2 - camera.s * (offset + disp - size / 2);
    const hi = -size / 2 - camera.s * (offset - size / 2);
    return Math.max(Math.min(lo, hi), Math.min(Math.max(lo, hi), -camera.s * (c - size / 2)));
  };
  return { tx: axis(camera.cx, W, l.ox, l.dispW), ty: axis(camera.cy, H, l.oy, l.dispH) };
}

// Bagian gambar (koordinat sebelum kamera) yang terlihat di layar.
function viewOf(camera: Camera, l: ReturnType<typeof layout>): View {
  const { tx, ty } = translate(camera, l);
  return {
    left: W / 2 + (-W / 2 - tx) / camera.s,
    right: W / 2 + (W / 2 - tx) / camera.s,
    top: H / 2 + (-H / 2 - ty) / camera.s,
    bottom: H / 2 + (H / 2 - ty) / camera.s,
    s: camera.s,
  };
}

type View = { left: number; right: number; top: number; bottom: number; s: number };

export function PhotoLayer({ asset, variant, look }: { asset: SceneAssetProps; variant: number; look: Look }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const l = layout(asset);
  const { cover, dispW, dispH, ox, oy } = l;
  const subjects = asset.subjects ?? [];
  // Sorotan menunggu subjeknya disebut, tidak dipaksa muncul di awal adegan.
  const beats = useBeats(
    subjects.map((s) => [s.cue, s.label]),
    { waitForCue: true },
  );

  // Kotak gambar (0–1) ke koordinat layar sebelum kamera.
  const toScreen = (b: Box) => ({ x: ox + b.x * dispW, y: oy + b.y * dispH, w: b.w * dispW, h: b.h * dispH });
  // Kamera yang membuat kotak mengisi sebagian layar, dibatasi agar tidak terlalu dekat.
  const frameBox = (b: Box, fill: number, max: number): Camera => {
    const r = toScreen(b);
    const s = Math.max(1.06, Math.min(max, W / (r.w * fill), H / (r.h * fill)));
    return { s, cx: r.x + r.w / 2, cy: r.y + r.h / 2 };
  };
  const subjectCameras = subjects.map((s) => frameBox(s.box, 2.4, 1.4));

  let camera: Camera;
  const t = interpolate(frame, [0, durationInFrames], [0, 1], { extrapolateRight: "clamp" });
  if (!asset.focus && subjects.length === 0) {
    camera = fallbackCamera(variant, t);
  } else {
    // Mulai lebar, lalu mendekati subjek utama, lalu tiap subjek saat disebut.
    const keys: (Camera & { at: number })[] = [];
    if (asset.focus) {
      const at = Math.min(durationInFrames * 0.45, (beats[0] ?? Infinity) - 10);
      keys.push({ ...frameBox(asset.focus, 1.9, 1.3), at: Math.max(MOVE_FRAMES, at) });
    }
    subjectCameras.forEach((c, i) => keys.push({ ...c, at: beats[i] + MOVE_FRAMES / 2 }));
    camera = { s: 1.04, cx: W / 2, cy: H / 2 };
    for (const key of keys.sort((a, b) => a.at - b.at)) {
      const k = interpolate(frame, [key.at - MOVE_FRAMES, key.at], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.inOut(Easing.cubic),
      });
      if (k <= 0) break;
      camera = {
        s: camera.s + (key.s - camera.s) * k,
        cx: camera.cx + (key.cx - camera.cx) * k,
        cy: camera.cy + (key.cy - camera.cy) * k,
      };
    }
    // Tetap bergerak perlahan di antara perpindahan.
    camera = { ...camera, s: camera.s * (1 + 0.035 * t) };
  }

  const { tx, ty } = translate(camera, l);
  // Goyangan halus proyektor film lama.
  const weave =
    look === "archival"
      ? { x: (random(`w-${frame}`) - 0.5) * 2.4, y: (random(`h-${frame}`) - 0.5) * 1.6 }
      : { x: 0, y: 0 };
  const transform = `translate(${tx + weave.x}px, ${ty + weave.y}px) scale(${camera.s})`;
  const filter = LOOK_FILTERS[look];

  return (
    <AbsoluteFill style={{ backgroundColor: theme.night, overflow: "hidden" }}>
      {!cover && (
        <Img
          src={asset.src}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            filter: `${filter} blur(40px) brightness(0.45)`,
            transform: "scale(1.2)",
          }}
        />
      )}
      <AbsoluteFill style={{ transform, transformOrigin: "50% 50%" }}>
        <Img src={asset.src} style={{ position: "absolute", left: ox, top: oy, width: dispW, height: dispH, filter }} />
        <Spotlights
          subjects={subjects.map((s, i) => ({
            ...toScreen(s.box),
            label: s.label,
            // Label ditata untuk posisi kamera saat tiba di subjek ini.
            view: viewOf(subjectCameras[i], l),
          }))}
          beats={beats}
          scale={camera.s}
        />
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// Sorotan subjek yang sedang disebut: bagian lain gambar diredupkan, subjek
// dilingkari garis emas yang tergambar, dan diberi label. Tiap sorotan tampil
// sampai subjek berikutnya disebut.
function Spotlights({
  subjects,
  beats,
  scale,
}: {
  subjects: { x: number; y: number; w: number; h: number; label: string; view: View }[];
  beats: number[];
  scale: number;
}) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  if (subjects.length === 0) return null;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {subjects.map((s, i) => {
        const from = beats[i];
        const to = Math.max(from + 30, beats[i + 1] ?? durationInFrames);
        const appear = interpolate(frame, [from, from + 14, to - 8, to], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (appear <= 0) return null;
        const draw = interpolate(frame, [from, from + 22], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const cx = s.x + s.w / 2;
        const cy = s.y + s.h / 2;
        const rx = (s.w / 2) * 1.15;
        const ry = (s.h / 2) * 1.15;
        const circumference = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
        // Garis dan teks dikecilkan sebanding pembesaran kamera agar tetap sama besar di layar.
        const k = 1 / scale;
        const v = s.view;
        // Ukuran di layar tetap (dibagi pembesaran kamera saat tiba di subjek ini).
        const u = 1 / v.s;
        const fontSize = 40 * u;
        const pad = 16 * u;
        const bar = 6 * u;
        const plateW = s.label.length * fontSize * 0.56 + 2 * pad + bar;
        const plateH = fontSize * 1.55;
        const gap = 36 * u;
        const margin = 48 * u;
        // Batas bawah di atas area subtitle.
        const bottom = v.bottom - 200 * u;
        // Label di sisi yang lebih lega; bila tidak muat di kedua sisi, di bawah subjek.
        const roomRight = v.right - margin - (cx + rx + gap);
        const roomLeft = cx - rx - gap - (v.left + margin);
        const side = roomRight >= plateW ? "right" : roomLeft >= plateW ? "left" : "below";
        const clamp = (value: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), value));
        const px =
          side === "right"
            ? cx + rx + gap
            : side === "left"
              ? cx - rx - gap - plateW
              : clamp(cx - plateW / 2, v.left + margin, v.right - margin - plateW);
        const py =
          side === "below"
            ? clamp(cy + ry + gap, v.top + margin, bottom - plateH)
            : clamp(cy - ry * 0.35 - plateH / 2, v.top + margin, bottom - plateH);
        // Garis penunjuk dari tepi lingkaran ke tepi label.
        const line =
          side === "right"
            ? { x1: cx + rx, y1: cy, x2: px, y2: py + plateH / 2 }
            : side === "left"
              ? { x1: cx - rx, y1: cy, x2: px + plateW, y2: py + plateH / 2 }
              : { x1: cx, y1: cy + ry, x2: clamp(cx, px + pad, px + plateW - pad), y2: py };
        const barX = side === "left" ? px + plateW - bar : px;
        const textX = side === "left" ? px + pad : px + bar + pad;
        // Label bergeser masuk dari arah subjek.
        const slide = (1 - draw) * 24 * u * (side === "left" ? 1 : side === "right" ? -1 : 0);
        return (
          <g key={i} opacity={appear}>
            <defs>
              <mask id={`spot-${i}`}>
                <rect x={-W} y={-H} width={3 * W} height={3 * H} fill="#fff" />
                <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#000" />
              </mask>
            </defs>
            <rect x={-W} y={-H} width={3 * W} height={3 * H} fill="#000" opacity={0.42} mask={`url(#spot-${i})`} />
            <ellipse
              cx={cx}
              cy={cy}
              rx={rx}
              ry={ry}
              fill="none"
              stroke={theme.goldStrong}
              strokeWidth={4 * k}
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - draw)}
              style={{ filter: `drop-shadow(0 0 ${8 * k}px rgba(224, 181, 101, 0.55))` }}
            />
            <line {...line} stroke={theme.goldStrong} strokeWidth={2.5 * k} opacity={draw} />
            <g opacity={draw} transform={`translate(${slide} 0)`}>
              <rect x={px} y={py} width={plateW} height={plateH} fill="rgba(8, 11, 14, 0.78)" />
              <rect x={barX} y={py} width={bar} height={plateH} fill={theme.goldStrong} />
              <text
                x={textX}
                y={py + plateH / 2 + fontSize * 0.36}
                fontFamily={theme.sans}
                fontSize={fontSize}
                fontWeight={700}
                letterSpacing={fontSize * 0.04}
                fill={theme.ink}
              >
                {s.label.toUpperCase()}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
