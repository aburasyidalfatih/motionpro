// Data yang dibutuhkan template video sejarah. Dibangun dari database oleh
// src/lib/video/props.ts; di sini hanya tipe murni agar bisa dipakai di
// browser (Remotion Player), Remotion Studio, dan renderer.

export type WordTiming = { word: string; startMs: number; endMs: number };

// Jenis satuan militer untuk simbol peta (APP-6/MIL-STD-2525, lewat milsymbol).
export type UnitKind = "infantry" | "cavalry" | "armor" | "artillery" | "naval" | "air" | "hq";

// `cue`: kata atau frasa dari narasi saat elemen itu muncul (lihat beats.ts).
// `unit`: titik digambar sebagai simbol satuan; `battle`: titik lokasi bentrokan.
export type MapPoint = {
  label: string;
  lat: number;
  lng: number;
  side?: number;
  cue?: string;
  unit?: UnitKind;
  battle?: boolean;
};

export type SceneMap = {
  caption: string;
  points: MapPoint[];
  route: boolean;
  // Pihak yang bertikai; indeks dipakai oleh titik, panah, dan zona.
  sides?: string[];
  arrows?: { from: number; to: number; side: number; cue?: string }[];
  zones?: { point: number; radiusKm: number; side: number }[];
  // Negara masa kini yang disorot dengan warna pihak (nama Natural Earth, Inggris).
  countries?: { name: string; side: number; cue?: string }[];
  // Garis depan melalui titik-titik (indeks), tergambar saat cue diucapkan.
  front?: { points: number[]; cue?: string };
};

export type TimelineMark = { date: string; label: string; cue?: string };

export type Stat = { value: number; prefix?: string; suffix?: string; label: string; cue?: string };

export type Comparison = {
  left: string;
  right: string;
  rows: { label: string; left: string; right: string; leftValue?: number; rightValue?: number; cue?: string }[];
};

// Grafik batang: nilai per tahun atau per pihak.
export type Chart = {
  prefix?: string;
  suffix?: string;
  bars: { label: string; value: number; cue?: string }[];
};

// Profil tokoh: nama, peran, masa hidup, dan beberapa fakta singkat.
export type Profile = { name: string; role: string; years?: string; facts: string[] };

// Data adegan grafis (disimpan di Scene.graphicData).
export type GraphicData = {
  map?: SceneMap;
  timeline?: TimelineMark;
  kinetic?: { lines: string[]; emphasis: string[] };
  events?: TimelineMark[];
  stats?: Stat[];
  comparison?: Comparison;
  quote?: { text: string; source: string };
  chart?: Chart;
  profile?: Profile;
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
  mood: string | null;
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
  // Musik latar per bagian: trek mulai di adegan `fromScene` sampai bagian berikutnya.
  music: { src: string; fromScene: number }[];
  // Efek suara per jenis; beberapa file per jenis dipakai bergantian.
  sfx: { whoosh: string[]; impact: string[]; pop: string[]; paper: string[]; riser: string[] };
  // Suara latar suasana (angin, pertempuran di kejauhan, hujan) per rentang adegan.
  ambience: { src: string; fromScene: number; toScene: number }[];
  subtitles: boolean;
  // Butiran film, grading, dan light leak (lihat finishing.tsx).
  finishing: boolean;
  // Motion blur saat transisi; menambah waktu render, hanya aktif saat render
  // atau di Chrome dengan HTML-in-canvas.
  motionBlur: boolean;
  // End screen 20 detik untuk elemen akhir YouTube (video berikutnya, subscribe).
  endScreen: boolean;
};
