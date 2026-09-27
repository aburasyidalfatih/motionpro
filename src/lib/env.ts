import { z } from "zod";

// Variabel lingkungan yang wajib ada sejak Fase 0. Kunci API untuk fase
// berikutnya divalidasi di modul yang memakainya.
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL belum diisi di .env"),
  REDIS_URL: z.string().min(1, "REDIS_URL belum diisi di .env"),
  STORAGE_DIR: z.string().default("./storage"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `- ${i.message}`).join("\n");
      throw new Error(`Konfigurasi .env tidak valid:\n${issues}`);
    }
    cached = parsed.data;
  }
  return cached;
}
