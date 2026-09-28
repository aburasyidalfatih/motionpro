import { fakeAssets } from "./fake";
import { pexels, pexelsEnabled } from "./pexels";
import type { AssetCandidate, AssetProvider } from "./types";
import { wikimedia } from "./wikimedia";

export const CANDIDATES_PER_SCENE = 8;

type Search = { provider: AssetProvider; kind: "images" | "videos" };

// Urutan sumber per tipe visual. Niche sejarah mengutamakan lukisan dan arsip
// (Wikimedia Commons); footage suasana diambil dari Pexels bila ada API key.
function searchPlan(visualType: string): Search[] {
  if (process.env.AI_PROVIDER === "fake") {
    return [{ provider: fakeAssets, kind: visualType === "footage" ? "videos" : "images" }];
  }
  const plan: Search[] = [];
  if (visualType === "footage" && pexelsEnabled()) plan.push({ provider: pexels, kind: "videos" });
  plan.push({ provider: wikimedia, kind: "images" });
  if (pexelsEnabled()) plan.push({ provider: pexels, kind: "images" });
  return plan;
}

// F-13: mencari kandidat untuk satu adegan dari beberapa kata kunci.
// Sumber yang gagal dilewati; error hanya dilempar bila semua sumber gagal.
export async function findCandidates(visualType: string, queries: string[], limit = CANDIDATES_PER_SCENE) {
  const results: AssetCandidate[] = [];
  const errors: string[] = [];
  let attempts = 0;

  for (const { provider, kind } of searchPlan(visualType)) {
    for (const query of queries) {
      if (results.length >= limit) return results;
      attempts++;
      try {
        const search = kind === "videos" ? provider.searchVideos : provider.searchImages;
        if (!search) continue;
        const found = await search.call(provider, query, { limit: limit - results.length });
        for (const candidate of found) {
          const duplicate = results.some(
            (r) => r.provider === candidate.provider && r.providerId === candidate.providerId,
          );
          if (!duplicate) results.push(candidate);
        }
      } catch (err) {
        errors.push(`${provider.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }
  if (results.length === 0 && errors.length === attempts && attempts > 0) {
    throw new Error(`Pencarian aset gagal (${[...new Set(errors)].join("; ")})`);
  }
  return results;
}

export { pexelsEnabled };
