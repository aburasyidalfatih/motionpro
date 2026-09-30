import type { Asset, Project, Scene, SceneAsset, Voiceover } from "@/generated/prisma/client";
import { ambiencePlan, libraryUrl, listAmbience, listMusic, listSfx, musicPlan } from "@/lib/library";
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

// Efek suara per jenis menurut awalan nama file (whoosh-1.mp3, whoosh-2.mp3, ...).
async function pickSfx(urls: UrlResolver) {
  const files = await listSfx();
  const all = (prefix: string) =>
    files.filter((f) => f.toLowerCase().startsWith(prefix)).map((f) => urls.library(`sfx/${f}`));
  return { whoosh: all("whoosh"), impact: all("impact"), pop: all("pop"), paper: all("paper"), riser: all("riser") };
}

// Data lengkap template video sejarah untuk satu proyek.
export async function buildVideoProps(
  project: ProjectForVideo,
  urls: UrlResolver,
  options: { subtitles: boolean; motionBlur?: boolean; finishing?: boolean },
): Promise<HistoryVideoProps> {
  return {
    style: project.style,
    title: project.scenes.find((s) => s.visualType === "title")?.onScreenText || project.topic,
    subtitles: options.subtitles,
    finishing: options.finishing ?? true,
    motionBlur: options.motionBlur ?? false,
    music: project.musicTrack
      ? musicPlan(project.musicTrack, project.musicPerChapter ? await listMusic() : [], project.scenes).map((part) => ({
          src: urls.library(`music/${part.track}`),
          fromScene: part.fromScene,
        }))
      : [],
    sfx: await pickSfx(urls),
    ambience: ambiencePlan(await listAmbience(), project.scenes).map((part) => ({
      src: urls.library(`ambience/${part.file}`),
      fromScene: part.fromScene,
      toScene: part.toScene,
    })),
    scenes: project.scenes.map((scene) => {
      const asset = scene.assets[0]?.asset;
      const graphic = (scene.graphicData ?? {}) as GraphicData;
      return {
        id: scene.id,
        durationMs: scene.durationMs ?? 5000,
        visualType: scene.visualType,
        mood: scene.mood,
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
