import { SECONDS_PER_SCENE, WORDS_PER_MINUTE } from "./prompts";
import type { Outline, SceneDraft } from "./schemas";
import type { ProjectBrief, ScriptAI } from "./types";

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

    async followUpResearch(project) {
      await pause(200);
      return { questions: [`Berapa jumlah pasukan dalam ${project.topic}?`] };
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
        quotes: [{ text: "Contoh kutipan tokoh.", speaker: "Contoh tokoh, 1945", sources: refs }],
        hooks: [
          `Bagaimana ${project.topic} mengubah Nusantara?`,
          `Kisah yang jarang diceritakan tentang ${project.topic}.`,
          `Semua berawal dari satu keputusan.`,
        ],
        angles: ["Sudut cerita contoh A", "Sudut cerita contoh B"],
      };
    },

    async outlineScript(project): Promise<Outline> {
      await pause(300);
      const chapters = Math.max(2, Math.round(project.targetMinutes / 2));
      return {
        title: project.topic,
        thumbnailText: "Kisah yang terlupakan",
        hook: `Momen paling dramatis dari ${project.topic}.`,
        chapters: Array.from({ length: chapters }, (_, i) => ({
          title: `Contoh bab ${i + 1}`,
          summary: `Isi contoh bab ${i + 1}.`,
          points: ["Fakta contoh A", "Fakta contoh B"],
          reHook: "Twist contoh",
          openLoop: "Pertanyaan contoh",
          mood: i === chapters - 1 ? "somber" : "tense",
          minutes: project.targetMinutes / chapters,
        })),
        ending: "Penutup contoh",
      };
    },

    async writeChapter({ project, outline, part, sceneCount }) {
      await pause(300);
      const offset = part.kind === "opening" ? 0 : 100 * (part.index + 1);
      const scenes = Array.from({ length: sceneCount }, (_, i) => sampleScene(project, offset + i));
      if (part.kind === "opening") {
        scenes[scenes.length - 1] = { ...sampleScene(project, 0), onScreenText: outline.title };
      } else {
        scenes[0] = { ...sampleScene(project, 0), onScreenText: outline.chapters[part.index].title };
      }
      return { scenes };
    },

    // Mode tiruan: pemeriksaan tidak mengubah apa pun.
    async reviewChapter({ scenes }) {
      await pause(100);
      return { issues: [], scenes };
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

// Adegan contoh ke-i: adegan 0 kartu judul, sisanya berputar melalui semua tipe
// grafis; gaya arsip menyisipkan lukisan dan footage.
function sampleScene(project: ProjectBrief, i: number): SceneDraft {
  const perScene = Math.round((SECONDS_PER_SCENE * WORDS_PER_MINUTE) / 60);
  const filler = Array.from({ length: perScene }, () => "narasi").join(" ");
  const base = { narration: `Adegan contoh ${i + 1}. ${filler}`, onScreenText: "", keywords: [] };
  if (i === 0) return { ...base, onScreenText: project.topic, visualType: "title", mood: "epic" };
  const cycle =
    project.style === "ARCHIVAL"
      ? ["map", "painting", "stat", "footage", "comparison", "profile"]
      : ["kinetic_text", "map", "timeline", "stat", "chart", "comparison", "profile", "quote", "illustration"];
  switch (cycle[(i - 1) % cycle.length]) {
    case "kinetic_text":
      return {
        ...base,
        visualType: "kinetic_text",
        mood: "tense",
        kinetic: { lines: ["Contoh teks kinetik", `adegan ${i + 1}`], emphasis: ["kinetik"] },
      };
    case "map":
      return {
        ...base,
        visualType: "map",
        mood: "tense",
        map: {
          caption: "Contoh peta pertempuran",
          route: false,
          sides: ["Pihak A", "Pihak B"],
          points: [
            { label: "Surabaya", lat: -7.26, lng: 112.75, side: 1, battle: true },
            { label: "Tanjung Perak", lat: -7.2, lng: 112.73, side: 0, unit: "infantry" },
          ],
          arrows: [{ from: 1, to: 0, side: 0 }],
        },
      };
    case "timeline":
      return {
        ...base,
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
        ...base,
        visualType: "stat",
        mood: "epic",
        onScreenText: "Contoh angka",
        stats: [{ value: 200000, label: "contoh angka" }],
      };
    case "chart":
      return {
        ...base,
        visualType: "chart",
        mood: "calm",
        onScreenText: "Contoh grafik",
        chart: {
          suffix: " prajurit",
          bars: [
            { label: "1825", value: 20000 },
            { label: "1828", value: 35000 },
            { label: "1830", value: 50000 },
          ],
        },
      };
    case "comparison":
      return {
        ...base,
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
    case "profile":
      return {
        ...base,
        visualType: "profile",
        mood: "calm",
        profile: { name: "Contoh Tokoh", role: "Contoh peran", years: "1785–1855", facts: ["Contoh fakta tokoh"] },
      };
    case "quote":
      return {
        ...base,
        visualType: "quote",
        mood: "somber",
        quote: { text: "Contoh kutipan tokoh.", source: "Contoh sumber" },
      };
    case "illustration":
      return {
        ...base,
        visualType: "illustration",
        mood: "tense",
        illustration: { prompt: "Contoh ilustrasi: kapal perang di pelabuhan saat fajar" },
      };
    case "footage":
      return { ...base, visualType: "footage", mood: "calm", keywords: ["ocean waves"] };
    default:
      return {
        ...base,
        visualType: "painting",
        mood: "tense",
        keywords: ["javanese war painting"],
        timeline: { date: "1350", label: "Contoh tanggal penting" },
      };
  }
}
