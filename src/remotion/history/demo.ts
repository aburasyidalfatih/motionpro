import type { HistoryVideoProps } from "./types";

// Data contoh untuk Remotion Studio (npm run studio) tanpa database: kartu judul,
// peta dengan rute, dan adegan dengan penanda tahun. Tanpa aset dan audio.
export const demoProps: HistoryVideoProps = {
  title: "Kejayaan Majapahit",
  subtitles: true,
  musicSrc: null,
  sfx: { whoosh: null, impact: null },
  scenes: [
    {
      id: "demo-1",
      durationMs: 5000,
      visualType: "title",
      onScreenText: "Kejayaan Majapahit",
      narrationSrc: null,
      words: [],
      asset: null,
      map: null,
      timeline: null,
    },
    {
      id: "demo-2",
      durationMs: 7000,
      visualType: "map",
      onScreenText: null,
      narrationSrc: null,
      words: [
        { word: "Dari", startMs: 300, endMs: 600 },
        { word: "Trowulan,", startMs: 600, endMs: 1300 },
        { word: "pengaruh", startMs: 1600, endMs: 2100 },
        { word: "Majapahit", startMs: 2100, endMs: 2800 },
        { word: "menjangkau", startMs: 2800, endMs: 3400 },
        { word: "seluruh", startMs: 3400, endMs: 3900 },
        { word: "Nusantara.", startMs: 3900, endMs: 4800 },
      ],
      asset: null,
      map: {
        caption: "Jalur pengaruh Majapahit, abad ke-14",
        route: true,
        points: [
          { label: "Trowulan", lat: -7.56, lng: 112.38 },
          { label: "Bali", lat: -8.4, lng: 115.19 },
          { label: "Makassar", lat: -5.14, lng: 119.42 },
          { label: "Banda", lat: -4.52, lng: 129.9 },
        ],
      },
      timeline: null,
    },
    {
      id: "demo-3",
      durationMs: 6000,
      visualType: "painting",
      onScreenText: "Sumpah Palapa",
      narrationSrc: null,
      words: [],
      asset: null,
      map: null,
      timeline: { date: "1336", label: "Gajah Mada mengucapkan Sumpah Palapa" },
    },
  ],
};
