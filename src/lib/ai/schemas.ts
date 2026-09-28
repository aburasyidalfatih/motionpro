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

// Tipe visual adegan. Tipe grafis digambar sepenuhnya oleh template (tanpa aset
// pihak ketiga); hanya ASSET_VISUAL_TYPES yang butuh gambar atau video.
export const graphicVisualTypes = ["title", "kinetic_text", "map", "timeline", "stat", "comparison", "quote"] as const;
export const assetVisualTypes = ["painting", "archival_photo", "footage"] as const;
export const visualTypes = [...graphicVisualTypes, ...assetVisualTypes] as const;
export type VisualType = (typeof visualTypes)[number];

export function needsAsset(visualType: string) {
  return (assetVisualTypes as readonly string[]).includes(visualType);
}

export const moods = ["epic", "tense", "calm", "somber", "hopeful", "mysterious"] as const;

export const mapDataSchema = z.object({
  caption: z.string().describe("Keterangan singkat peta, misalnya Pertempuran Surabaya, November 1945"),
  points: z
    .array(
      z.object({
        label: z.string(),
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        side: z.number().int().optional().describe("Indeks pihak di sides bila titik milik salah satu pihak"),
      }),
    )
    .min(1)
    .max(12),
  route: z.boolean().describe("true bila titik-titik membentuk rute berurutan, misalnya jalur pelayaran"),
  sides: z
    .array(z.string())
    .max(3)
    .optional()
    .describe("Nama pihak yang bertikai atau bersaing, misalnya ['Sekutu', 'Pejuang Indonesia']"),
  arrows: z
    .array(
      z.object({
        from: z.number().int().describe("Indeks titik asal"),
        to: z.number().int().describe("Indeks titik tujuan"),
        side: z.number().int().describe("Indeks pihak yang bergerak"),
      }),
    )
    .max(8)
    .optional()
    .describe("Panah gerak pasukan, armada, atau pengaruh"),
  zones: z
    .array(
      z.object({
        point: z.number().int().describe("Indeks titik pusat"),
        radiusKm: z.number().min(5).max(3000),
        side: z.number().int(),
      }),
    )
    .max(6)
    .optional()
    .describe("Wilayah kekuasaan atau area pengaruh berbentuk lingkaran"),
});
export type MapData = z.infer<typeof mapDataSchema>;

export const timelineMarkSchema = z.object({
  date: z.string(),
  label: z.string(),
});

export const kineticSchema = z.object({
  lines: z.array(z.string().describe("Baris pendek, maksimal 6 kata")).min(1).max(3),
  emphasis: z.array(z.string()).max(4).describe("Kata yang ditekankan (disorot), diambil dari lines"),
});

export const eventsSchema = z.array(timelineMarkSchema).min(2).max(7);

export const statsSchema = z
  .array(
    z.object({
      value: z.number().describe("Angka, misalnya 40000"),
      prefix: z.string().optional().describe("Awalan, misalnya 'US$'"),
      suffix: z.string().optional().describe("Akhiran, misalnya '%' atau ' km'"),
      label: z.string().describe("Arti angka, misalnya 'prajurit Mongol'"),
    }),
  )
  .min(1)
  .max(3);

export const comparisonSchema = z.object({
  left: z.string().describe("Nama pihak kiri"),
  right: z.string().describe("Nama pihak kanan"),
  rows: z
    .array(
      z.object({
        label: z.string().describe("Aspek yang dibandingkan, misalnya 'Jumlah pasukan'"),
        left: z.string(),
        right: z.string(),
        leftValue: z.number().optional().describe("Nilai angka pihak kiri bila bisa dibandingkan"),
        rightValue: z.number().optional(),
      }),
    )
    .min(2)
    .max(5),
});

export const quoteSchema = z.object({
  text: z.string(),
  source: z.string().describe("Siapa yang mengucapkan atau dari dokumen apa"),
});

// Data grafis per adegan, disimpan di Scene.graphicData.
export const graphicDataSchema = z.object({
  map: mapDataSchema.optional(),
  timeline: timelineMarkSchema.optional(),
  kinetic: kineticSchema.optional(),
  events: eventsSchema.optional(),
  stats: statsSchema.optional(),
  comparison: comparisonSchema.optional(),
  quote: quoteSchema.optional(),
});
export type GraphicData = z.infer<typeof graphicDataSchema>;

export const sceneSchema = z.object({
  narration: z.string().describe("Teks yang dibacakan narator"),
  onScreenText: z.string().describe("Teks singkat di layar, boleh kosong"),
  keywords: z
    .array(z.string().describe("Kata kunci pencarian aset dalam bahasa Inggris"))
    .max(8)
    .describe("Wajib untuk painting, archival_photo, footage; boleh kosong untuk tipe grafis"),
  visualType: z.enum(visualTypes),
  mood: z.enum(moods),
  map: mapDataSchema.optional().describe("Wajib bila visualType = map"),
  timeline: timelineMarkSchema.optional().describe("Penanda tanggal penting di pojok layar, untuk tipe apa pun"),
  kinetic: kineticSchema.optional().describe("Wajib bila visualType = kinetic_text"),
  events: eventsSchema.optional().describe("Wajib bila visualType = timeline"),
  stats: statsSchema.optional().describe("Wajib bila visualType = stat"),
  comparison: comparisonSchema.optional().describe("Wajib bila visualType = comparison"),
  quote: quoteSchema.optional().describe("Wajib bila visualType = quote"),
});
export type SceneDraft = z.infer<typeof sceneSchema>;

export const scriptSchema = z.object({
  title: z.string().describe("Judul kerja video"),
  scenes: z.array(sceneSchema).min(3).max(120),
});
export type Script = z.infer<typeof scriptSchema>;

// F-14: kandidat aset yang relevan per adegan, urut dari yang paling cocok.
export const assetRankingSchema = z.object({
  scenes: z.array(
    z.object({
      scene: z.number().int().describe("Nomor adegan seperti di daftar"),
      relevant: z.array(z.number().int()).describe("Nomor kandidat yang cocok, paling cocok dulu"),
    }),
  ),
});
export type AssetRanking = z.infer<typeof assetRankingSchema>;

// Batasan jumlah dan rentang membuat skema terlalu kompleks bagi Gemini
// (error 400 INVALID_ARGUMENT), jadi tidak dikirim. Batasan itu tetap
// diperiksa oleh zod saat jawaban divalidasi.
const CONSTRAINT_KEYS = new Set(["minItems", "maxItems", "minimum", "maximum", "minLength", "maxLength"]);

function stripConstraints(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripConstraints);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !CONSTRAINT_KEYS.has(key) && key !== "$schema")
        .map(([key, v]) => [key, stripConstraints(v)]),
    );
  }
  return value;
}

// Konversi ke JSON Schema untuk parameter responseJsonSchema Gemini.
export function toGeminiSchema(schema: z.ZodType) {
  return stripConstraints(z.toJSONSchema(schema, { io: "output" })) as Record<string, unknown>;
}
