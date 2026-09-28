import type { Asset, Project, Scene, SceneAsset, Voiceover } from "@/generated/prisma/client";
import { libraryUrl, listSfx } from "@/lib/library";
import { fileUrl } from "@/lib/storage";
import type { GraphicData, HistoryVideoProps, WordTiming } from "@/remotion/history/types";

export type ProjectForVideo = Project & {
  scenes: (Scene & { assets: (SceneAsset & { asset: Asset })[]; voiceover: Voiceover | null })[];
};

// Cara membentuk URL file: di browser lewat /api/files dan /api/library; saat
// render lewat server file lokal milik worker (lihat static-server.ts).
export type UrlResolver = {
  file: (relative: string) => string;
  library: (relative: string) => string;
};

export const browserUrls: UrlResolver = { file: fileUrl, library: libraryUrl };

export const projectVideoInclude = {
  scenes: {
    orderBy: { order: "asc" },
    include: { assets: { where: { selected: true }, include: { asset: true } }, voiceover: true },
  },
} as const;

async function pickSfx(urls: UrlResolver) {
  const files = await listSfx();
  const find = (prefix: string) => {
    const file = files.find((f) => f.toLowerCase().startsWith(prefix));
    return file ? urls.library(`sfx/${file}`) : null;
  };
  return { whoosh: find("whoosh"), impact: find("impact") };
}

// Data lengkap template video sejarah untuk satu proyek.
export async function buildVideoProps(
  project: ProjectForVideo,
  urls: UrlResolver,
  options: { subtitles: boolean },
): Promise<HistoryVideoProps> {
  return {
    style: project.style,
    title: project.scenes.find((s) => s.visualType === "title")?.onScreenText || project.topic,
    subtitles: options.subtitles,
    musicSrc: project.musicTrack ? urls.library(`music/${project.musicTrack}`) : null,
    sfx: await pickSfx(urls),
    scenes: project.scenes.map((scene) => {
      const asset = scene.assets[0]?.asset;
      const graphic = (scene.graphicData ?? {}) as GraphicData;
      return {
        id: scene.id,
        durationMs: scene.durationMs ?? 5000,
        visualType: scene.visualType,
        onScreenText: scene.onScreenText,
        narrationSrc: scene.voiceover ? urls.file(scene.voiceover.audioPath) : null,
        words: scene.voiceover ? (scene.voiceover.wordTimestamps as WordTiming[]) : [],
        asset: asset?.localPath
          ? {
              src: urls.file(asset.localPath),
              kind: asset.kind === "VIDEO" ? "VIDEO" : "IMAGE",
              width: asset.width,
              height: asset.height,
              durationMs: asset.durationMs,
            }
          : null,
        graphic,
      };
    }),
  };
}
