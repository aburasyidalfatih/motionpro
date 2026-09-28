import { queryVariants } from "./query";
import { USER_AGENT, type AssetCandidate, type AssetProvider } from "./types";

// Wikimedia Commons: lukisan, peta lama, dan foto arsip. Sumber utama niche sejarah.
// API: https://commons.wikimedia.org/wiki/Commons:API/MediaWiki

const API = "https://commons.wikimedia.org/w/api.php";
const MIN_WIDTH = 800;
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

type ImageInfo = {
  url: string;
  thumburl?: string;
  descriptionurl?: string;
  width: number;
  height: number;
  mime: string;
  extmetadata?: Record<string, { value?: string }>;
};

type SearchResponse = {
  query?: {
    pages?: {
      pageid: number;
      index?: number;
      title: string;
      imageinfo?: ImageInfo[];
    }[];
  };
};

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

// Hanya lisensi yang aman untuk channel yang dimonetisasi: domain publik, CC0,
// CC BY, CC BY-SA. Lisensi non-komersial (NC) dan tanpa turunan (ND) ditolak.
export function isAllowedLicense(license: string) {
  const l = license.toLowerCase();
  if (/\bnc\b|non-?commercial|\bnd\b|no-?deriv/.test(l)) return false;
  return /public domain|^pd\b|pd-|cc0|cc[ -]by/.test(l);
}

export const wikimedia: AssetProvider = {
  name: "wikimedia",

  // Frasa lengkap dulu, lalu variasi yang makin umum sampai kandidat cukup.
  async searchImages(query, { limit }) {
    const results: AssetCandidate[] = [];
    for (const variant of queryVariants(query)) {
      for (const candidate of await searchOnce(variant, limit)) {
        if (!results.some((r) => r.providerId === candidate.providerId)) results.push(candidate);
      }
      if (results.length >= Math.ceil(limit / 2)) break;
    }
    return results.slice(0, limit);
  },
};

async function searchOnce(query: string, limit: number) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: String(Math.min(limit * 3, 50)),
    prop: "imageinfo",
    iiprop: "url|size|mime|extmetadata",
    iiurlwidth: "500",
    iiextmetadatafilter: "LicenseShortName|Artist|ObjectName",
  });
  const response = await fetch(`${API}?${params}`, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!response.ok) throw new Error(`Wikimedia Commons ${response.status}`);
  const data = (await response.json()) as SearchResponse;

  const pages = [...(data.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const results: AssetCandidate[] = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info || !IMAGE_MIMES.has(info.mime) || info.width < MIN_WIDTH) continue;
    const license = stripHtml(info.extmetadata?.LicenseShortName?.value ?? "");
    if (!isAllowedLicense(license)) continue;
    const name = info.extmetadata?.ObjectName?.value;
    results.push({
      kind: "IMAGE",
      provider: "wikimedia",
      providerId: String(page.pageid),
      title: name ? stripHtml(name) : page.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, ""),
      originalUrl: info.url,
      previewUrl: info.thumburl ?? null,
      pageUrl: info.descriptionurl ?? null,
      author: info.extmetadata?.Artist?.value ? stripHtml(info.extmetadata.Artist.value).slice(0, 200) : null,
      license,
      width: info.width,
      height: info.height,
      durationMs: null,
    });
    if (results.length >= limit) break;
  }
  return results;
}
