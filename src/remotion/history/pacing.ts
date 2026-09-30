import { beatFrames, chartCues, type Cue, eventCues, statCues } from "./beats";
import { CROSSFADE_FRAMES, FPS, sceneTimings } from "./timing";
import type { HistoryVideoProps, SceneProps } from "./types";

// Pemeriksaan ritme sebelum render: bagian yang terlalu lama tanpa perubahan
// visual, tipe visual yang berulang, dan porsi teks kinetik. Dihitung dari data
// yang sama dengan template (beats.ts), jadi mencerminkan video yang akan dirender.

// Lebih dari ini tanpa elemen baru mulai terasa lambat bagi penonton YouTube.
const MAX_STILL_SECONDS = 5;
// Gambar (lukisan, foto, ilustrasi) tetap bergerak karena kamera, tetapi lebih
// dari ini tanpa perpindahan ke subjek baru terasa seperti slide.
const MAX_IMAGE_SECONDS = 8;
const IMAGE_TYPES = new Set(["painting", "archival_photo", "illustration"]);

export type PacingIssue = { scene: number; message: string };

// Penanda elemen yang muncul bertahap per tipe adegan.
function elementCues(scene: SceneProps): Cue[] {
  const g = scene.graphic;
  switch (scene.visualType) {
    case "map":
      return [
        ...(g.map?.points ?? []).map((p): Cue => [p.cue, p.label]),
        ...(g.map?.arrows ?? []).map((a): Cue => [a.cue]),
        ...(g.map?.countries ?? []).map((c): Cue => [c.cue, c.name]),
      ];
    case "stat":
      return g.stats ? statCues(g.stats) : [];
    case "timeline":
      return g.events ? eventCues(g.events) : [];
    case "chart":
      return g.chart ? chartCues(g.chart) : [];
    case "comparison":
      return (g.comparison?.rows ?? []).map((r): Cue => [r.cue, r.label, r.left, r.right]);
    case "kinetic_text":
      return (g.kinetic?.lines ?? []).map((line): Cue => [line]);
    case "profile":
      return [[g.profile?.name], ...(g.profile?.facts ?? []).map((f): Cue => [f])];
    default:
      return [];
  }
}

// Adegan yang terus bergerak sendiri (kutipan terbuka kata demi kata, footage)
// tidak diperiksa jedanya; gambar diperiksa terpisah (imageIssue).
const CONTINUOUS = new Set(["quote", "painting", "archival_photo", "footage", "illustration", "title"]);

const longestGap = (moments: number[]) => {
  const sorted = [...moments].sort((a, b) => a - b);
  return Math.max(...sorted.slice(1).map((m, k) => m - sorted[k]));
};

// Gambar: momen kamera berpindah adalah saat tiba di fokus utama dan saat tiap
// subjek disebut (sama dengan PhotoLayer di photo.tsx).
function imageIssue(scene: SceneProps, frames: number, lead: number): string | null {
  const asset = scene.asset;
  if (!asset || asset.kind !== "IMAGE" || !IMAGE_TYPES.has(scene.visualType)) return null;
  const subjects = asset.subjects ?? [];
  const total = frames + lead;
  if (!asset.focus && subjects.length === 0) {
    return total / FPS > MAX_IMAGE_SECONDS
      ? `gambar tanpa analisis tampil ${Math.round(total / FPS)} detik; pecah adegan atau pilih ulang aset agar kamera punya fokus`
      : null;
  }
  const beats = beatFrames(
    { words: scene.words, offset: lead },
    subjects.map((s): Cue => [s.cue, s.label]),
    FPS,
    total,
    { waitForCue: true },
  );
  const moments = [lead, ...beats, total];
  if (asset.focus) moments.push(Math.max(30, Math.min(total * 0.45, (beats[0] ?? Infinity) - 10)));
  const longest = longestGap(moments);
  return longest / FPS > MAX_IMAGE_SECONDS
    ? `${Math.round(longest / FPS)} detik gambar tanpa sorotan baru; pecah adegan atau pilih gambar dengan lebih banyak detail`
    : null;
}

export function pacingIssues(props: HistoryVideoProps): PacingIssue[] {
  const issues: PacingIssue[] = [];
  const timings = sceneTimings(props);

  props.scenes.forEach((scene, i) => {
    const { frames } = timings[i];
    const lead = i === 0 ? 0 : CROSSFADE_FRAMES;
    if (!CONTINUOUS.has(scene.visualType)) {
      const beats = beatFrames({ words: scene.words, offset: lead }, elementCues(scene), FPS, frames + lead);
      const longest = longestGap([lead, ...beats, frames + lead]);
      if (longest / FPS > MAX_STILL_SECONDS) {
        issues.push({
          scene: i,
          message: `${Math.round(longest / FPS)} detik tanpa elemen baru; pecah adegan atau tambah elemen (titik, angka, baris)`,
        });
      }
    }
    const image = imageIssue(scene, frames, lead);
    if (image) issues.push({ scene: i, message: image });
    if (i >= 2 && scene.visualType !== "title") {
      const same = props.scenes.slice(i - 2, i + 1).every((s) => s.visualType === scene.visualType);
      if (same) issues.push({ scene: i, message: `tipe visual yang sama 3 kali berturut-turut (${scene.visualType})` });
    }
  });

  const kinetic = props.scenes.filter((s) => s.visualType === "kinetic_text").length;
  if (props.scenes.length >= 8 && kinetic / props.scenes.length > 0.3) {
    issues.push({
      scene: -1,
      message: `${Math.round((kinetic / props.scenes.length) * 100)}% adegan berupa teks kinetik; ganti sebagian dengan peta, angka, atau ilustrasi`,
    });
  }
  return issues;
}
