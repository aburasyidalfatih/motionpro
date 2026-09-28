// Data yang dibutuhkan template video sejarah. Dibangun dari database oleh
// src/lib/video/props.ts; di sini hanya tipe murni agar bisa dipakai di
// browser (Remotion Player), Remotion Studio, dan renderer.

export type WordTiming = { word: string; startMs: number; endMs: number };

export type MapPoint = { label: string; lat: number; lng: number };

export type SceneMap = { caption: string; points: MapPoint[]; route: boolean };

export type SceneAssetProps = {
  src: string;
  kind: "IMAGE" | "VIDEO";
  width: number | null;
  height: number | null;
  durationMs: number | null;
};

export type SceneProps = {
  id: string;
  durationMs: number;
  visualType: string;
  onScreenText: string | null;
  narrationSrc: string | null;
  words: WordTiming[];
  asset: SceneAssetProps | null;
  map: SceneMap | null;
  timeline: { date: string; label: string } | null;
};

export type HistoryVideoProps = {
  title: string;
  scenes: SceneProps[];
  musicSrc: string | null;
  sfx: { whoosh: string | null; impact: string | null };
  subtitles: boolean;
};
