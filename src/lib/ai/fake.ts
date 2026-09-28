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
      const scenes: SceneDraft[] = Array.from({ length: count }, (_, i) => {
        if (i === 0) {
          return {
            narration: `Contoh hook tentang ${project.topic}. ${filler}`,
            onScreenText: project.topic,
            keywords: ["ancient java temple"],
            visualType: "title",
            mood: "epic",
          };
        }
        if (i % 4 === 1) {
          return {
            narration: `Adegan peta contoh ${i + 1}. ${filler}`,
            onScreenText: "",
            keywords: ["java island old map"],
            visualType: "map",
            mood: "calm",
            map: {
              caption: "Contoh peta Jawa Timur",
              points: [
                { label: "Trowulan", lat: -7.56, lng: 112.38 },
                { label: "Tuban", lat: -6.9, lng: 112.05 },
              ],
              route: true,
            },
          };
        }
        return {
          narration: `Adegan contoh ${i + 1}. ${filler}`,
          onScreenText: "",
          keywords: ["javanese kingdom painting"],
          visualType: "painting",
          mood: "tense",
          timeline: i === 2 ? { date: "1350", label: "Contoh tanggal penting" } : undefined,
        };
      });
      return { title: project.topic, scenes };
    },

    async rewriteScene({ scene, instruction }) {
      await pause(300);
      return { ...scene, narration: `${scene.narration} (ditulis ulang: ${instruction || "tanpa instruksi"})` };
    },
  };
}
