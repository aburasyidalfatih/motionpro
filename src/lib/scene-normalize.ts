import { isThirdPartyVisual, type GraphicData, type SceneDraft, type VisualType } from "@/lib/ai/schemas";

export type VideoStyleName = "GRAPHIC" | "ARCHIVAL";

// Data wajib per tipe visual grafis; adegan tanpa data itu tidak bisa digambar.
const REQUIRED: Partial<Record<VisualType, keyof GraphicData>> = {
  map: "map",
  timeline: "events",
  stat: "stats",
  comparison: "comparison",
  quote: "quote",
  chart: "chart",
  profile: "profile",
};

// Baris teks kinetik dari teks layar atau awal narasi (maksimal 6 kata per baris).
export function kineticFallback(draft: Pick<SceneDraft, "onScreenText" | "narration">) {
  const source = draft.onScreenText?.trim() || draft.narration.split(/[.!?]/)[0];
  const words = source.trim().split(/\s+/).slice(0, 12);
  const lines = [words.slice(0, 6).join(" "), words.slice(6).join(" ")].filter(Boolean);
  return { lines, emphasis: [] };
}

// Memastikan adegan bisa digambar: gaya full grafis tidak memakai tipe aset,
// dan tipe grafis yang datanya tidak diisi Gemini diganti teks kinetik.
export function normalizeScene<T extends SceneDraft>(draft: T, style: VideoStyleName): T {
  let visualType = draft.visualType;
  if (style === "GRAPHIC" && isThirdPartyVisual(visualType)) visualType = "kinetic_text";
  const required = REQUIRED[visualType];
  if (required && !draft[required]) visualType = style === "ARCHIVAL" ? "painting" : "kinetic_text";

  const result = { ...draft, visualType };
  if (visualType === "kinetic_text" && !result.kinetic?.lines.length) result.kinetic = kineticFallback(draft);
  return result;
}
