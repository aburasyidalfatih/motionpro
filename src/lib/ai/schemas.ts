import { z } from "zod";

// Skema output Gemini. Dipakai dua kali: dikirim sebagai JSON Schema agar
// Gemini menjawab dalam bentuk yang tepat, lalu untuk memvalidasi jawabannya.

export const researchPlanSchema = z.object({
  questions: z
    .array(z.string().describe("Satu pertanyaan riset yang spesifik dan bisa dicari di web"))
    .min(4)
    .max(8),
});
export type ResearchPlan = z.infer<typeof researchPlanSchema>;

export const briefSchema = z.object({
  summary: z.string().describe("Ringkasan topik 2–3 paragraf"),
  facts: z
    .array(
      z.object({
        text: z.string().describe("Satu fakta, angka, atau detail penting"),
        sources: z.array(z.number().int()).describe("Nomor sumber pendukung, misalnya [1, 3]"),
      }),
    )
    .min(5)
    .max(30),
  timeline: z
    .array(
      z.object({
        date: z.string().describe("Tanggal atau tahun, misalnya 1293 atau 1 Juni 1945"),
        event: z.string(),
      }),
    )
    .max(30),
  hooks: z.array(z.string().describe("Kalimat pembuka video yang memancing rasa penasaran")).min(3).max(5),
  angles: z.array(z.string().describe("Sudut cerita yang menarik atau jarang diketahui")).max(6),
});
export type Brief = z.infer<typeof briefSchema>;

export const visualTypes = ["title", "painting", "archival_photo", "map", "timeline", "footage"] as const;
export const moods = ["epic", "tense", "calm", "somber", "hopeful", "mysterious"] as const;

export const mapDataSchema = z.object({
  caption: z.string().describe("Keterangan singkat peta, misalnya Wilayah Majapahit abad ke-14"),
  points: z
    .array(
      z.object({
        label: z.string(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
      }),
    )
    .min(1)
    .max(12),
  route: z.boolean().describe("true bila titik-titik membentuk rute berurutan, misalnya gerak pasukan"),
});
export type MapData = z.infer<typeof mapDataSchema>;

export const timelineMarkSchema = z.object({
  date: z.string(),
  label: z.string(),
});

export const sceneSchema = z.object({
  narration: z.string().describe("Teks yang dibacakan narator"),
  onScreenText: z.string().describe("Teks singkat di layar, boleh kosong"),
  keywords: z
    .array(z.string().describe("Kata kunci pencarian aset dalam bahasa Inggris"))
    .min(1)
    .max(5),
  visualType: z.enum(visualTypes),
  mood: z.enum(moods),
  map: mapDataSchema.optional().describe("Wajib diisi bila visualType = map"),
  timeline: timelineMarkSchema.optional().describe("Diisi bila adegan menandai tanggal penting"),
});
export type SceneDraft = z.infer<typeof sceneSchema>;

export const scriptSchema = z.object({
  title: z.string().describe("Judul kerja video"),
  scenes: z.array(sceneSchema).min(3).max(120),
});
export type Script = z.infer<typeof scriptSchema>;

// Konversi ke JSON Schema untuk parameter responseJsonSchema Gemini.
export function toGeminiSchema(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { io: "output" }) as Record<string, unknown>;
  delete json.$schema;
  return json;
}
