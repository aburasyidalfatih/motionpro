import { queryVariants } from "./query";
import type { AssetCandidate, AssetProvider } from "./types";

// Pexels: footage suasana dan foto. Butuh PEXELS_API_KEY (gratis).
// API: https://www.pexels.com/api/documentation/

type PexelsPhoto = {
  id: number;
  width: number;
  height: number;
  url: string;
  alt?: string;
  photographer: string;
  src: { original: string; large2x: string; medium: string };
};

type PexelsVideo = {
  id: number;
  width: number;
  height: number;
  duration: number;
  url: string;
  image: string;
  user: { name: string };
  video_files: {
    quality: string | null;
    file_type: string;
    width: number | null;
    height: number | null;
    link: string;
  }[];
};

const LICENSE = "Pexels License";

// Pexels mencari berdasarkan makna, tapi kata gaya ("cinematic intro") justru
// menarik hasil yang tidak relevan; pakai frasa tanpa kata pengisi.
const clean = (query: string) => queryVariants(query)[1] ?? query;

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY belum diisi");
  const response = await fetch(`https://api.pexels.com${path}?${new URLSearchParams(params)}`, {
    headers: { Authorization: key },
  });
  if (!response.ok) throw new Error(`Pexels ${response.status}`);
  return (await response.json()) as T;
}

// File MP4 dengan lebar terdekat ke 1920 tanpa melebihinya (lebih kecil = unduhan cepat).
function bestFile(video: PexelsVideo) {
  const mp4 = video.video_files.filter((f) => f.file_type === "video/mp4" && f.width);
  const fitting = mp4.filter((f) => (f.width ?? 0) <= 1920).sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return fitting[0] ?? mp4.sort((a, b) => (a.width ?? 0) - (b.width ?? 0))[0];
}

export function pexelsEnabled() {
  return Boolean(process.env.PEXELS_API_KEY);
}

export const pexels: AssetProvider = {
  name: "pexels",

  async searchImages(query, { limit }) {
    const data = await get<{ photos: PexelsPhoto[] }>("/v1/search", {
      query: clean(query),
      per_page: String(limit),
      orientation: "landscape",
    });
    return data.photos.map(
      (p): AssetCandidate => ({
        kind: "IMAGE",
        provider: "pexels",
        providerId: `photo-${p.id}`,
        title: p.alt || query,
        originalUrl: p.src.large2x,
        previewUrl: p.src.medium,
        pageUrl: p.url,
        author: p.photographer,
        license: LICENSE,
        width: p.width,
        height: p.height,
        durationMs: null,
      }),
    );
  },

  async searchVideos(query, { limit }) {
    const data = await get<{ videos: PexelsVideo[] }>("/videos/search", {
      query: clean(query),
      per_page: String(limit),
      orientation: "landscape",
    });
    return data.videos.flatMap((v): AssetCandidate[] => {
      const file = bestFile(v);
      if (!file) return [];
      return [
        {
          kind: "VIDEO",
          provider: "pexels",
          providerId: `video-${v.id}`,
          title: query,
          originalUrl: file.link,
          previewUrl: v.image,
          pageUrl: v.url,
          author: v.user.name,
          license: LICENSE,
          width: file.width,
          height: file.height,
          durationMs: v.duration * 1000,
        },
      ];
    });
  },
};
