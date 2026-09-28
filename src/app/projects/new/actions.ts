"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { toneOptions } from "@/lib/labels";
import { enqueueJob } from "@/lib/queue";

const schema = z.object({
  topic: z.string().trim().min(5, "Topik minimal 5 karakter").max(200, "Topik maksimal 200 karakter"),
  targetMinutes: z.coerce.number().int().min(1, "Durasi minimal 1 menit").max(15, "Durasi maksimal 15 menit"),
  language: z.enum(["id", "en"]),
  tone: z.enum(toneOptions.map((t) => t.value) as [string, ...string[]]),
  style: z.enum(["GRAPHIC", "ARCHIVAL"]),
});

export type NewProjectState = { error?: string };

// F-01: membuat proyek lalu langsung memulai riset.
export async function createProject(_prev: NewProjectState, formData: FormData): Promise<NewProjectState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Isian tidak valid" };

  let projectId: string;
  try {
    const project = await db.project.create({ data: parsed.data });
    projectId = project.id;
    await enqueueJob("RESEARCH", { projectId });
  } catch (err) {
    return { error: `Gagal membuat proyek: ${err instanceof Error ? err.message : String(err)}` };
  }
  redirect(`/projects/${projectId}/research`);
}
