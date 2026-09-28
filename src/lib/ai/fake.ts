import { WORDS_PER_MINUTE } from "./prompts";
import type { SceneDraft, Script } from "./schemas";
import type { ScriptAI } from "./types";

// Implementasi tiruan untuk menguji alur tanpa API key (AI_PROVIDER=fake).
// Hasilnya contoh tetap, bukan riset sungguhan.

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createFakeAI(): ScriptAI {
  return {
    async planResearch(project) {
      await pause(300);
      return {
        questions: [
          `Apa latar belakang ${project.topic}?`,
          `Siapa tokoh kunci dalam ${project.topic}?`,
          `Bagaimana kronologi peristiwa ${project.topic}?`,
          `Di mana lokasi-lokasi penting ${project.topic}?`,
          `Apa dampak ${project.topic} bagi sejarah Nusantara?`,
        ],
      };
    },

    async research(project, question) {
      await pause(300);
      const slug = encodeURIComponent(question.slice(0, 20));
      return {
        question,
        text: `Catatan contoh untuk "${question}" (mode tiruan, bukan hasil riset).`,
        sources: [
          { title: "Contoh Ensiklopedia", url: `https://example.org/ensiklopedia/${slug}` },
          { title: "Contoh Arsip Museum", url: "https://example.org/arsip" },
        ],
        suggestionHtml: `<div style="font-family:sans-serif;font-size:13px;padding:8px">Contoh Google Search Suggestions: ${project.topic}</div>`,
      };
    },

    async synthesizeBrief(project, _notes, sources) {
      await pause(300);
      const refs = sources.slice(0, 2).map((s) => s.position);
      return {
        summary: `Ringkasan contoh tentang ${project.topic}. Isi ini dibuat oleh mode tiruan untuk menguji alur aplikasi.`,
        facts: Array.from({ length: 6 }, (_, i) => ({
          text: `Fakta contoh ke-${i + 1} tentang ${project.topic}.`,
          sources: refs,
        })),
        timeline: [
          { date: "1293", event: "Contoh peristiwa pertama" },
          { date: "1350", event: "Contoh peristiwa puncak" },
          { date: "1527", event: "Contoh peristiwa akhir" },
        ],
        hooks: [
          `Bagaimana ${project.topic} mengubah Nusantara?`,
          `Kisah yang jarang diceritakan tentang ${project.topic}.`,
          `Semua berawal dari satu keputusan.`,
        ],
        angles: ["Sudut cerita contoh A", "Sudut cerita contoh B"],
      };
    },

    async writeScript(project): Promise<Script> {
      await pause(500);
      const count = Math.max(3, Math.round(project.targetMinutes * 6));
      const perScene = Math.round((project.targetMinutes * WORDS_PER_MINUTE) / count);
      const filler = Array.from({ length: perScene }, () => "narasi").join(" ");
      const base = (i: number) => ({ narration: `Adegan contoh ${i + 1}. ${filler}`, onScreenText: "", keywords: [] });
      // Berputar melalui semua tipe grafis; gaya arsip menyisipkan lukisan.
      const cycle =
        project.style === "ARCHIVAL"
          ? ["map", "painting", "stat", "footage", "comparison"]
          : ["kinetic_text", "map", "timeline", "stat", "comparison", "quote"];
      const scenes: SceneDraft[] = Array.from({ length: count }, (_, i): SceneDraft => {
        if (i === 0) return { ...base(i), onScreenText: project.topic, visualType: "title", mood: "epic" };
        const type = cycle[(i - 1) % cycle.length];
        switch (type) {
          case "kinetic_text":
            return {
              ...base(i),
              visualType: "kinetic_text",
              mood: "tense",
              kinetic: { lines: ["Contoh teks kinetik", `adegan ${i + 1}`], emphasis: ["kinetik"] },
            };
          case "map":
            return {
              ...base(i),
              visualType: "map",
              mood: "tense",
              map: {
                caption: "Contoh peta pertempuran",
                route: false,
                sides: ["Pihak A", "Pihak B"],
                points: [
                  { label: "Surabaya", lat: -7.26, lng: 112.75, side: 1 },
                  { label: "Tanjung Perak", lat: -7.2, lng: 112.73, side: 0 },
                ],
                arrows: [{ from: 1, to: 0, side: 0 }],
              },
            };
          case "timeline":
            return {
              ...base(i),
              visualType: "timeline",
              mood: "calm",
              onScreenText: "Contoh kronologi",
              events: [
                { date: "1825", label: "Peristiwa pertama" },
                { date: "1828", label: "Peristiwa kedua" },
                { date: "1830", label: "Peristiwa ketiga" },
              ],
            };
          case "stat":
            return {
              ...base(i),
              visualType: "stat",
              mood: "epic",
              onScreenText: "Contoh angka",
              stats: [{ value: 200000, label: "contoh angka" }],
            };
          case "comparison":
            return {
              ...base(i),
              visualType: "comparison",
              mood: "tense",
              comparison: {
                left: "Pihak A",
                right: "Pihak B",
                rows: [
                  { label: "Pasukan", left: "30.000", right: "20.000", leftValue: 30000, rightValue: 20000 },
                  { label: "Senjata", left: "Modern", right: "Terbatas" },
                ],
              },
            };
          case "quote":
            return {
              ...base(i),
              visualType: "quote",
              mood: "somber",
              quote: { text: "Contoh kutipan tokoh.", source: "Contoh sumber" },
            };
          case "footage":
            return { ...base(i), visualType: "footage", mood: "calm", keywords: ["ocean waves"] };
          default:
            return {
              ...base(i),
              visualType: "painting",
              mood: "tense",
              keywords: ["javanese war painting"],
              timeline: { date: "1350", label: "Contoh tanggal penting" },
            };
        }
      });
      return { title: project.topic, scenes };
    },

    // Mode tiruan: semua kandidat dianggap relevan, urutan tetap.
    async rankAssets(_project, scenes) {
      return { scenes: scenes.map((s, scene) => ({ scene, relevant: s.candidates.map((_, i) => i) })) };
    },

    async rewriteScene({ scene, instruction }) {
      await pause(300);
      return { ...scene, narration: `${scene.narration} (ditulis ulang: ${instruction || "tanpa instruksi"})` };
    },
  };
}
