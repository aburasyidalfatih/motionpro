import type { HistoryVideoProps, SceneProps, WordTiming } from "./types";

// Data contoh untuk Remotion Studio (npm run studio) dan halaman Pratinjau
// template: semua tipe adegan grafis, tanpa aset dan tanpa audio.

// Waktu kata tiruan (sekitar 2,5 kata per detik) agar subtitle terlihat.
function words(text: string): WordTiming[] {
  return text.split(/\s+/).map((word, i) => ({ word, startMs: 300 + i * 400, endMs: 300 + i * 400 + 350 }));
}

function scene(id: string, durationMs: number, visualType: string, rest: Partial<SceneProps>): SceneProps {
  return {
    id,
    durationMs,
    visualType,
    onScreenText: null,
    narrationSrc: null,
    words: [],
    asset: null,
    graphic: {},
    ...rest,
  };
}

export const demoProps: HistoryVideoProps = {
  title: "Pertempuran Surabaya",
  style: "GRAPHIC",
  subtitles: true,
  musicSrc: null,
  sfx: { whoosh: null, impact: null },
  scenes: [
    scene("demo-title", 4500, "title", { onScreenText: "Pertempuran Surabaya" }),
    scene("demo-kinetic", 5500, "kinetic_text", {
      words: words("Pada 10 November 1945, sebuah kota menolak untuk menyerah."),
      graphic: {
        kinetic: { lines: ["10 November 1945", "Kota yang menolak menyerah"], emphasis: ["menolak", "menyerah"] },
      },
    }),
    scene("demo-map", 8000, "map", {
      graphic: {
        map: {
          caption: "Pendaratan Sekutu di Surabaya, Oktober 1945",
          route: false,
          sides: ["Sekutu (Inggris)", "Pejuang Indonesia"],
          points: [
            { label: "Tanjung Perak", lat: -7.2, lng: 112.73, side: 0 },
            { label: "Surabaya", lat: -7.26, lng: 112.75, side: 1 },
            { label: "Gresik", lat: -7.16, lng: 112.65 },
            { label: "Sidoarjo", lat: -7.45, lng: 112.72, side: 1 },
          ],
          arrows: [
            { from: 0, to: 1, side: 0 },
            { from: 3, to: 1, side: 1 },
          ],
          zones: [{ point: 1, radiusKm: 12, side: 1 }],
        },
      },
    }),
    scene("demo-timeline", 8000, "timeline", {
      onScreenText: "Menuju 10 November",
      graphic: {
        events: [
          { date: "25 Okt", label: "Pasukan Sekutu mendarat" },
          { date: "30 Okt", label: "Brigjen Mallaby tewas" },
          { date: "9 Nov", label: "Ultimatum Sekutu" },
          { date: "10 Nov", label: "Serangan besar dimulai" },
        ],
      },
    }),
    scene("demo-comparison", 7000, "comparison", {
      graphic: {
        comparison: {
          left: "Sekutu",
          right: "Indonesia",
          rows: [
            { label: "Tank dan artileri berat", left: "Ada", right: "Sangat terbatas" },
            { label: "Pesawat dan kapal perang", left: "Ada", right: "Tidak ada" },
            { label: "Senjata utama pejuang", left: "Senapan modern", right: "Senapan rampasan" },
          ],
        },
      },
    }),
    scene("demo-stat", 6000, "stat", {
      onScreenText: "Tiga minggu pertempuran",
      graphic: {
        stats: [
          { value: 3, suffix: " minggu", label: "pertempuran kota" },
          { value: 1945, label: "tahun kemerdekaan" },
        ],
      },
    }),
    scene("demo-quote", 6500, "quote", {
      graphic: { quote: { text: "Merdeka atau mati!", source: "Bung Tomo, November 1945" } },
    }),
  ],
};
