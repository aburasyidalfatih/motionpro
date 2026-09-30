import { beatFrames, chartCues, type Cue, eventCues, statCues } from "./beats";
import { CROSSFADE_FRAMES, FPS, sceneTimings } from "./timing";
import type { HistoryVideoProps, SceneProps } from "./types";

// Pemeriksaan ritme sebelum render: bagian yang terlalu lama tanpa perubahan
// visual, tipe visual yang berulang, dan porsi teks kinetik. Dihitung dari data
// yang sama dengan template (beats.ts), jadi mencerminkan video yang akan dirender.

// Lebih dari ini tanpa elemen baru mulai terasa lambat bagi penonton YouTube.
const MAX_STILL_SECONDS = 5;

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

// Adegan yang terus bergerak sendiri (kutipan terbuka kata demi kata, gambar
// dengan ken-burns dan partikel, footage) tidak diperiksa jedanya.
const CONTINUOUS = new Set(["quote", "painting", "archival_photo", "footage", "illustration", "title"]);

export function pacingIssues(props: HistoryVideoProps): PacingIssue[] {
  const issues: PacingIssue[] = [];
  const timings = sceneTimings(props);

  props.scenes.forEach((scene, i) => {
    const { frames } = timings[i];
    const lead = i === 0 ? 0 : CROSSFADE_FRAMES;
    if (!CONTINUOUS.has(scene.visualType)) {
      const beats = beatFrames({ words: scene.words, offset: lead }, elementCues(scene), FPS, frames + lead);
      const moments = [lead, ...beats, frames + lead].sort((a, b) => a - b);
      const longest = Math.max(...moments.slice(1).map((m, k) => m - moments[k]));
      if (longest / FPS > MAX_STILL_SECONDS) {
        issues.push({
          scene: i,
          message: `${Math.round(longest / FPS)} detik tanpa elemen baru; pecah adegan atau tambah elemen (titik, angka, baris)`,
        });
      }
    }
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
