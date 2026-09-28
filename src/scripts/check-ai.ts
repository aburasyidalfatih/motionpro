import "dotenv/config";
import { scriptAI } from "@/lib/ai";
import type { NumberedSource, ProjectBrief } from "@/lib/ai/types";
import { mapLimit } from "@/lib/async";
import { briefToMarkdown, countWords } from "@/lib/projects";

// Gate Fase 1: brief dan naskah JSON valid untuk 5 topik uji.
// Menjalankan riset + naskah langsung (tanpa database dan antrian).
//   npm run check:ai                      → 5 topik default, 3 menit
//   npm run check:ai -- "Topik A" "Topik B"
//   CHECK_MINUTES=10 npm run check:ai

const DEFAULT_TOPICS = [
  "Kejayaan dan keruntuhan Majapahit",
  "Perang Diponegoro 1825–1830",
  "Perlawanan Pattimura di Saparua 1817",
  "Kerajaan Sriwijaya sebagai kekuatan maritim",
  "Pertempuran Surabaya 10 November 1945",
];

async function checkTopic(topic: string, minutes: number) {
  const ai = scriptAI();
  const project: ProjectBrief = { topic, language: "id", tone: "dokumenter", targetMinutes: minutes };
  const started = Date.now();

  const plan = await ai.planResearch(project);
  const notes = await mapLimit(plan.questions, 3, (q) => ai.research(project, q));
  const sources: NumberedSource[] = [];
  for (const source of notes.flatMap((n) => n.sources)) {
    if (!sources.some((s) => s.url === source.url)) sources.push({ ...source, position: sources.length + 1 });
  }
  const brief = await ai.synthesizeBrief(project, notes, sources);
  const script = await ai.writeScript(project, briefToMarkdown(brief));

  const words = script.scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const maps = script.scenes.filter((s) => s.visualType === "map");
  return {
    topic,
    seconds: Math.round((Date.now() - started) / 1000),
    questions: plan.questions.length,
    sources: sources.length,
    facts: brief.facts.length,
    scenes: script.scenes.length,
    words,
    targetWords: minutes * 130,
    maps: maps.length,
    mapsWithoutData: maps.filter((s) => !s.map).length,
  };
}

async function main() {
  const topics = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TOPICS;
  const minutes = Number(process.env.CHECK_MINUTES ?? 3);
  console.log(`Memeriksa ${topics.length} topik, durasi ${minutes} menit, provider ${process.env.AI_PROVIDER || "gemini"}\n`);

  let failed = 0;
  for (const topic of topics) {
    try {
      const r = await checkTopic(topic, minutes);
      console.log(
        `LULUS  ${r.topic} (${r.seconds} dtk): ${r.questions} pertanyaan, ${r.sources} sumber, ${r.facts} fakta, ` +
          `${r.scenes} adegan, ${r.words}/${r.targetWords} kata, ${r.maps} peta` +
          (r.mapsWithoutData ? ` (${r.mapsWithoutData} tanpa koordinat)` : ""),
      );
    } catch (err) {
      failed++;
      console.log(`GAGAL  ${topic}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log(`\n${topics.length - failed}/${topics.length} topik lulus`);
  process.exit(failed ? 1 : 0);
}

void main();
