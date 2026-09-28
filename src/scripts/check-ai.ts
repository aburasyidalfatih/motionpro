import "dotenv/config";
import { aiConcurrency, scriptAI } from "@/lib/ai";
import type { NumberedSource, ProjectBrief } from "@/lib/ai/types";
import { mapLimit } from "@/lib/async";
import { briefToMarkdown, countWords } from "@/lib/projects";
import { normalizeScene } from "@/lib/scene-normalize";

// Gate Fase 1: brief dan naskah JSON valid untuk 5 topik uji.
// Menjalankan riset + naskah langsung (tanpa database dan antrian).
//   npm run check:ai                      → 5 topik default, 3 menit
//   npm run check:ai -- "Topik A" "Topik B"
//   CHECK_MINUTES=10 npm run check:ai

const DEFAULT_TOPICS = [
  "Pertempuran Surabaya 10 November 1945",
  "Perang Diponegoro 1825–1830",
  "Invasi Mongol ke Jawa 1293",
  "Kenapa Laut China Selatan diperebutkan?",
  "Kekuatan militer Indonesia dibanding negara ASEAN",
];

async function checkTopic(topic: string, minutes: number) {
  const ai = scriptAI();
  const project: ProjectBrief = { topic, style: "GRAPHIC", language: "id", tone: "dokumenter", targetMinutes: minutes };
  const started = Date.now();

  const plan = await ai.planResearch(project);
  const notes = await mapLimit(plan.questions, aiConcurrency(), (q) => ai.research(project, q));
  const sources: NumberedSource[] = [];
  for (const source of notes.flatMap((n) => n.sources)) {
    if (!sources.some((s) => s.url === source.url)) sources.push({ ...source, position: sources.length + 1 });
  }
  const brief = await ai.synthesizeBrief(project, notes, sources);
  const script = await ai.writeScript(project, briefToMarkdown(brief));

  const scenes = script.scenes.map((s) => normalizeScene(s, project.style));
  const words = scenes.reduce((sum, s) => sum + countWords(s.narration), 0);
  const types = [...new Set(scenes.map((s) => s.visualType))].join(", ");
  const maps = scenes.filter((s) => s.visualType === "map");
  return {
    topic,
    seconds: Math.round((Date.now() - started) / 1000),
    questions: plan.questions.length,
    sources: sources.length,
    facts: brief.facts.length,
    scenes: scenes.length,
    types,
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
          `${r.scenes} adegan, ${r.words}/${r.targetWords} kata, ${r.maps} peta, tipe: ${r.types}` +
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
