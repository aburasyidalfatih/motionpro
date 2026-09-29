import { z } from "zod";

// Skema output Gemini. Dipakai dua kali: dikirim sebagai JSON Schema agar
// Gemini menjawab dalam bentuk yang tepat, lalu untuk memvalidasi jawabannya.

// Daftar dengan batas jumlah. Kelebihan item dipotong, bukan ditolak, karena
// Gemini tidak menerima batasan jumlah di skema (lihat toGeminiSchema).
function list<T extends z.ZodType>(item: T, min: number, max: number) {
  return z.preprocess((v) => (Array.isArray(v) ? v.slice(0, max) : v), z.array(item).min(min).max(max));
}

// Data grafis adegan yang tidak valid (misalnya timeline dengan satu peristiwa)
// dibuang agar tidak menggagalkan seluruh naskah; normalizeScene lalu mengganti
// adegan itu dengan teks kinetik.
function lenient<T extends z.ZodType>(schema: T) {
  return schema.optional().catch(undefined);
}

export const researchPlanSchema = z.object({
  questions: list(z.string().describe("Satu pertanyaan riset yang spesifik dan bisa dicari di web"), 4, 12),
});
export type ResearchPlan = z.infer<typeof researchPlanSchema>;

// Putaran riset kedua: pertanyaan lanjutan untuk celah dan angka yang bertentangan.
export const followUpSchema = z.object({
  questions: list(z.string().describe("Pertanyaan lanjutan yang spesifik dan bisa dicari di web"), 0, 6),
});

export const briefSchema = z.object({
  summary: z.string().describe("Ringkasan topik 2–3 paragraf"),
  facts: list(
    z.object({
      text: z.string().describe("Satu fakta, angka, atau detail penting"),
      sources: z.array(z.number().int()).describe("Nomor sumber pendukung, misalnya [1, 3]"),
    }),
    5,
    80,
  ),
  timeline: list(
    z.object({
      date: z.string().describe("Tanggal atau tahun, misalnya 1293 atau 1 Juni 1945"),
      event: z.string(),
    }),
    0,
    30,
  ),
  quotes: list(
    z.object({
      text: z.string().describe("Kutipan asli, kata demi kata seperti di sumber"),
      speaker: z.string().describe("Siapa yang mengucapkan atau dokumen asalnya, dengan tahun"),
      sources: z.array(z.number().int()).describe("Nomor sumber pendukung"),
    }),
    0,
    8,
  )
    .optional()
    .default([]),
  hooks: list(z.string().describe("Kalimat pembuka video yang memancing rasa penasaran"), 3, 5),
  angles: list(z.string().describe("Sudut cerita yang menarik atau jarang diketahui"), 0, 6),
});
export type Brief = z.infer<typeof briefSchema>;

// Tipe visual adegan. Tipe grafis digambar sepenuhnya oleh template (tanpa aset
// pihak ketiga); hanya ASSET_VISUAL_TYPES yang butuh gambar atau video.
export const graphicVisualTypes = [
  "title",
  "kinetic_text",
  "map",
  "timeline",
  "stat",
  "chart",
  "comparison",
  "profile",
  "quote",
] as const;
export const assetVisualTypes = ["painting", "archival_photo", "footage"] as const;
export const visualTypes = [...graphicVisualTypes, ...assetVisualTypes] as const;
export type VisualType = (typeof visualTypes)[number];

export function needsAsset(visualType: string) {
  return (assetVisualTypes as readonly string[]).includes(visualType);
}

export const moods = ["epic", "tense", "calm", "somber", "hopeful", "mysterious"] as const;

// Kata atau frasa dari narasi adegan saat elemen grafis muncul di layar, agar
// visual berganti tepat ketika narator menyebutnya (lihat remotion/history/beats.ts).
const cue = () =>
  z
    .string()
    .optional()
    .describe("Kata atau frasa PERSIS dari narasi adegan ini saat elemen ini harus muncul, misalnya 'Tanjung Perak'");

export const mapDataSchema = z.object({
  caption: z.string().describe("Keterangan singkat peta, misalnya Pertempuran Surabaya, November 1945"),
  points: list(
    z.object({
      label: z.string(),
      place: z
        .string()
        .optional()
        .describe(
          "Nama tempat masa kini untuk mencari koordinat, lengkap dengan wilayah dan negara, misalnya 'Tanjung Perak, Surabaya, Indonesia'. Nama kuno diganti nama sekarang: Batavia menjadi 'Jakarta, Indonesia'",
        ),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      // Diisi worker (lib/geocode.ts): true bila lat/lng berasal dari OpenStreetMap.
      verified: z.boolean().optional().describe("Diisi sistem, jangan diisi"),
      side: z.number().int().optional().describe("Indeks pihak di sides bila titik milik salah satu pihak"),
      cue: cue(),
    }),
    1,
    12,
  ),
  route: z.boolean().describe("true bila titik-titik membentuk rute berurutan, misalnya jalur pelayaran"),
  sides: list(z.string(), 0, 3)
    .optional()
    .describe("Nama pihak yang bertikai atau bersaing, misalnya ['Sekutu', 'Pejuang Indonesia']"),
  arrows: list(
    z.object({
      from: z.number().int().describe("Indeks titik asal"),
      to: z.number().int().describe("Indeks titik tujuan"),
      side: z.number().int().describe("Indeks pihak yang bergerak"),
      cue: cue(),
    }),
    0,
    8,
  )
    .optional()
    .describe("Panah gerak pasukan, armada, atau pengaruh"),
  zones: list(
    z.object({
      point: z.number().int().describe("Indeks titik pusat"),
      radiusKm: z.number().min(5).max(3000),
      side: z.number().int(),
    }),
    0,
    6,
  )
    .optional()
    .describe("Wilayah kekuasaan atau area pengaruh berbentuk lingkaran"),
});
export type MapData = z.infer<typeof mapDataSchema>;

export const timelineMarkSchema = z.object({
  date: z.string(),
  label: z.string(),
  cue: cue(),
});

export const kineticSchema = z.object({
  lines: list(z.string().describe("Baris pendek, maksimal 6 kata"), 1, 3),
  emphasis: list(z.string(), 0, 4).describe("Kata yang ditekankan (disorot), diambil dari lines"),
});

export const eventsSchema = list(timelineMarkSchema, 2, 7);

export const statsSchema = list(
  z.object({
    value: z.number().describe("Angka, misalnya 40000"),
    prefix: z.string().optional().describe("Awalan, misalnya 'US$'"),
    suffix: z.string().optional().describe("Akhiran, misalnya '%' atau ' km'"),
    label: z.string().describe("Arti angka, misalnya 'prajurit Mongol'"),
    cue: cue(),
  }),
  1,
  3,
);

export const comparisonSchema = z.object({
  left: z.string().describe("Nama pihak kiri"),
  right: z.string().describe("Nama pihak kanan"),
  rows: list(
    z.object({
      label: z.string().describe("Aspek yang dibandingkan, misalnya 'Jumlah pasukan'"),
      left: z.string(),
      right: z.string(),
      leftValue: z.number().optional().describe("Nilai angka pihak kiri bila bisa dibandingkan"),
      rightValue: z.number().optional(),
      cue: cue(),
    }),
    2,
    5,
  ),
});

export const chartSchema = z.object({
  prefix: z.string().optional().describe("Awalan nilai, misalnya 'US$'"),
  suffix: z.string().optional().describe("Akhiran nilai, misalnya ' miliar' atau '%'"),
  bars: list(
    z.object({
      label: z.string().describe("Tahun atau nama pihak, misalnya '2015' atau 'Vietnam'"),
      value: z.number(),
      cue: cue(),
    }),
    2,
    8,
  ),
});

export const profileSchema = z.object({
  name: z.string().describe("Nama tokoh"),
  role: z.string().describe("Peran singkat, misalnya 'Komandan Tentara Keamanan Rakyat'"),
  years: z.string().optional().describe("Masa hidup atau masa jabatan, misalnya '1920–1981'"),
  facts: list(z.string().describe("Fakta singkat maksimal 8 kata"), 1, 3),
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
  chart: chartSchema.optional(),
  profile: profileSchema.optional(),
});
export type GraphicData = z.infer<typeof graphicDataSchema>;

export const sceneSchema = z.object({
  narration: z.string().describe("Teks yang dibacakan narator"),
  onScreenText: z.string().describe("Teks singkat di layar, boleh kosong"),
  keywords: list(z.string().describe("Kata kunci pencarian aset dalam bahasa Inggris"), 0, 8).describe(
    "Wajib untuk painting, archival_photo, footage; boleh kosong untuk tipe grafis",
  ),
  visualType: z.enum(visualTypes).catch("kinetic_text"),
  mood: z.enum(moods).catch("calm"),
  map: lenient(mapDataSchema).describe("Wajib bila visualType = map"),
  timeline: lenient(timelineMarkSchema).describe("Penanda tanggal penting di pojok layar, untuk tipe apa pun"),
  kinetic: lenient(kineticSchema).describe("Wajib bila visualType = kinetic_text"),
  events: lenient(eventsSchema).describe("Wajib bila visualType = timeline (minimal 2 peristiwa)"),
  stats: lenient(statsSchema).describe("Wajib bila visualType = stat"),
  comparison: lenient(comparisonSchema).describe("Wajib bila visualType = comparison (minimal 2 baris)"),
  quote: lenient(quoteSchema).describe("Wajib bila visualType = quote"),
  chart: lenient(chartSchema).describe("Wajib bila visualType = chart (minimal 2 batang)"),
  profile: lenient(profileSchema).describe("Wajib bila visualType = profile"),
});
export type SceneDraft = z.infer<typeof sceneSchema>;

export const scriptSchema = z.object({
  title: z.string().describe("Judul kerja video"),
  scenes: list(sceneSchema, 3, 200),
});
export type Script = z.infer<typeof scriptSchema>;

// Kerangka naskah: pembuka, bab-bab dengan open loop, dan penutup. Naskah lalu
// ditulis per bab dari kerangka ini (lib/ai/script-pipeline.ts).
export const outlineSchema = z.object({
  title: z.string().describe("Judul video yang memancing rasa penasaran"),
  hook: z
    .string()
    .describe(
      "Rencana pembuka (cold open): momen paling dramatis yang ditampilkan dulu dan pertanyaan besar yang ditanamkan",
    ),
  chapters: list(
    z.object({
      title: z.string().describe("Judul bab, maksimal 5 kata"),
      summary: z.string().describe("Isi bab dalam 1–2 kalimat"),
      points: list(z.string().describe("Fakta dari brief yang dibahas, lengkap dengan angka, nama, dan tempat"), 2, 12),
      reHook: z.string().describe("Fakta mengejutkan, twist, atau angka tak terduga di tengah bab"),
      openLoop: z.string().describe("Ketegangan atau pertanyaan di akhir bab yang membuat penonton lanjut"),
      mood: z.enum(moods).catch("calm"),
      minutes: z.number().describe("Perkiraan durasi bab dalam menit"),
    }),
    2,
    10,
  ),
  ending: z.string().describe("Rencana penutup: jawaban pertanyaan pembuka dan kalimat terakhir yang berkesan"),
});
export type Outline = z.infer<typeof outlineSchema>;

export const chapterScenesSchema = z.object({
  scenes: list(sceneSchema, 1, 60),
});

// Hasil pemeriksaan satu bab: masalah yang ditemukan dan adegan yang sudah diperbaiki.
export const chapterReviewSchema = z.object({
  issues: list(z.string().describe("Masalah yang ditemukan dan diperbaiki, singkat"), 0, 20),
  scenes: list(sceneSchema, 1, 60),
});
export type ChapterReview = z.infer<typeof chapterReviewSchema>;

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
const CONSTRAINT_KEYS = new Set(["minItems", "maxItems", "minimum", "maximum", "minLength", "maxLength", "default"]);

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
