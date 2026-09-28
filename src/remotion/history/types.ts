// Data yang dibutuhkan template video sejarah. Dibangun dari database oleh
// src/lib/video/props.ts; di sini hanya tipe murni agar bisa dipakai di
// browser (Remotion Player), Remotion Studio, dan renderer.

export type WordTiming = { word: string; startMs: number; endMs: number };

export type MapPoint = { label: string; lat: number; lng: number; side?: number };

export type SceneMap = {
  caption: string;
  points: MapPoint[];
  route: boolean;
  // Pihak yang bertikai; indeks dipakai oleh titik, panah, dan zona.
  sides?: string[];
  arrows?: { from: number; to: number; side: number }[];
  zones?: { point: number; radiusKm: number; side: number }[];
};

export type TimelineMark = { date: string; label: string };

export type Stat = { value: number; prefix?: string; suffix?: string; label: string };

export type Comparison = {
  left: string;
  right: string;
  rows: { label: string; left: string; right: string; leftValue?: number; rightValue?: number }[];
};

// Data adegan grafis (disimpan di Scene.graphicData).
export type GraphicData = {
  map?: SceneMap;
  timeline?: TimelineMark;
  kinetic?: { lines: string[]; emphasis: string[] };
  events?: TimelineMark[];
  stats?: Stat[];
  comparison?: Comparison;
  quote?: { text: string; source: string };
};

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
  graphic: GraphicData;
};

export type HistoryVideoProps = {
  title: string;
  style: "GRAPHIC" | "ARCHIVAL";
  scenes: SceneProps[];
  musicSrc: string | null;
  sfx: { whoosh: string | null; impact: string | null };
  subtitles: boolean;
};
