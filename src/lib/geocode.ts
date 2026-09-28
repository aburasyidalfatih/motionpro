import type { MapData } from "@/lib/ai/schemas";
import { USER_AGENT } from "@/lib/assets/types";
import { redis } from "@/lib/queue";

// Koordinat titik peta dari OpenStreetMap (Nominatim) menggantikan tebakan AI.
// Kebijakan Nominatim: paling banyak 1 permintaan per detik, User-Agent yang
// jelas, dan hasil di-cache (https://operations.osmfoundation.org/policies/nominatim/).
// GEOCODER=off mematikannya; dalam mode tiruan (AI_PROVIDER=fake) mati kecuali GEOCODER=on.

const MIN_INTERVAL_MS = 1100;
const CACHE_TTL_SECONDS = 90 * 24 * 60 * 60;
// Hasil yang lebih jauh dari ini dari tebakan AI dianggap tempat lain yang
// kebetulan bernama sama (misalnya "Perak" di Malaysia untuk Tanjung Perak).
const MAX_SHIFT_KM = 250;

type LatLng = { lat: number; lng: number };

export function geocoderEnabled() {
  const setting = process.env.GEOCODER;
  if (setting) return setting !== "off";
  return process.env.AI_PROVIDER !== "fake";
}

const baseUrl = () => (process.env.GEOCODER_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, "");

// Antrian agar permintaan ke Nominatim berjarak minimal MIN_INTERVAL_MS di worker ini.
let chain: Promise<unknown> = Promise.resolve();
let lastRequest = 0;
function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = lastRequest + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequest = Date.now();
    return fn();
  });
  chain = run.catch(() => {});
  return run;
}

// Kandidat lokasi untuk satu nama tempat, urut dari yang paling penting menurut OSM.
async function search(query: string): Promise<LatLng[]> {
  const key = `motionpro:geocode:${query.toLowerCase()}`;
  const cached = await redis()
    .get(key)
    .catch(() => null);
  if (cached) return JSON.parse(cached) as LatLng[];

  const params = new URLSearchParams({ q: query, format: "jsonv2", limit: "8", "accept-language": "id,en" });
  const response = await throttled(() =>
    fetch(`${baseUrl()}/search?${params}`, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15_000),
    }),
  );
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const results = (await response.json()) as { lat: string; lon: string }[];
  const candidates = results
    .map((r) => ({ lat: Number(r.lat), lng: Number(r.lon) }))
    .filter((c) => Number.isFinite(c.lat) && Number.isFinite(c.lng));
  await redis()
    .set(key, JSON.stringify(candidates), "EX", CACHE_TTL_SECONDS)
    .catch(() => {});
  return candidates;
}

export function distanceKm(a: LatLng, b: LatLng) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const round = (value: number) => Math.round(value * 10_000) / 10_000;

// Titik peta diberi koordinat OpenStreetMap bila tempatnya ditemukan dekat
// tebakan AI (verified: true); selain itu koordinat AI dipertahankan
// (verified: false). Geocoder yang tidak bisa dihubungi tidak menggagalkan job.
export async function geocodeMap(map: MapData): Promise<{ map: MapData; verified: number }> {
  // Tanda verified hanya boleh berasal dari geocoder, bukan dari jawaban AI.
  if (!geocoderEnabled()) return { map: { ...map, points: map.points.map((p) => ({ ...p, verified: undefined })) }, verified: 0 };
  let unavailable = false;
  let verified = 0;
  const points: MapData["points"] = [];
  for (const point of map.points) {
    const guess = { lat: point.lat, lng: point.lng };
    let found: LatLng | undefined;
    if (!unavailable) {
      try {
        const candidates = await search((point.place || point.label).trim());
        found = candidates.find((c) => distanceKm(c, guess) <= MAX_SHIFT_KM);
      } catch (err) {
        // Sekali gagal (jaringan, rate limit), sisa titik tidak dicoba agar job tidak lama menunggu.
        unavailable = true;
        console.warn(`[geocode] ${err instanceof Error ? err.message : String(err)}; koordinat AI dipakai`);
      }
    }
    if (found) verified++;
    points.push(
      found ? { ...point, lat: round(found.lat), lng: round(found.lng), verified: true } : { ...point, verified: false },
    );
  }
  return { map: { ...map, points }, verified };
}
