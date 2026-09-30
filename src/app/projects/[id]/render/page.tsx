import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { VideoCard } from "@/components/VideoCard";
import { needsAsset } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { formatDuration } from "@/lib/projects";
import { isSceneJob } from "@/lib/queue";
import { SubmitButton } from "@/components/SubmitButton";
import { browserUrls, buildVideoProps, projectVideoInclude } from "@/lib/video/props";
import { buildThumbnailProps } from "@/lib/video/thumbnail";
import { saveThumbnailText, startRender } from "./actions";
import { PacingCheck } from "./PacingCheck";
import { ThumbnailPreview } from "./ThumbnailPreview";
import { VideoPreview } from "./VideoPreview";

async function loadProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      ...projectVideoInclude,
      videos: { orderBy: { createdAt: "desc" } },
      jobs: { where: { status: { in: ["QUEUED", "RUNNING"] } } },
    },
  });
}

export default async function RenderPage({ params }: PageProps<"/projects/[id]/render">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();

  const busy = project.jobs.some((j) => !isSceneJob(j.input));
  const scenes = project.scenes;
  const withoutAsset = scenes.filter((s) => needsAsset(s.visualType) && !s.assets[0]).length;
  const withoutVoice = scenes.filter((s) => !s.voiceover).length;
  const canRender = scenes.length > 0 && withoutAsset === 0 && withoutVoice === 0;
  const props = await buildVideoProps(project, browserUrls, { subtitles: true });
  const totalMs = scenes.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  return (
    <div className="space-y-10">
      <AutoRefresh active={project.jobs.length > 0} />

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Pratinjau</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {scenes.length} adegan · {formatDuration(totalMs)}. Pratinjau diputar langsung di browser; hasil render
            identik, dalam 1080p atau 1440p 30 fps, dengan motion blur saat transisi dan audio dinormalkan ke -14 LUFS.
          </p>
        </div>

        {!canRender && scenes.length > 0 && (
          <p className="rounded-md border border-amber-300 p-3 text-sm text-amber-700 dark:border-amber-800 dark:text-amber-400">
            Belum bisa dirender:{" "}
            {withoutAsset > 0 && (
              <Link href={`/projects/${project.id}/storyboard`} className="underline">
                {withoutAsset} adegan tanpa aset
              </Link>
            )}
            {withoutAsset > 0 && withoutVoice > 0 && ", "}
            {withoutVoice > 0 && (
              <Link href={`/projects/${project.id}/audio`} className="underline">
                {withoutVoice} adegan tanpa voice over
              </Link>
            )}
            .
          </p>
        )}

        {scenes.length > 0 && <PacingCheck props={props} projectId={project.id} />}

        {scenes.length > 0 ? (
          <VideoPreview
            props={props}
            renderAction={startRender.bind(null, project.id)}
            canRender={canRender}
            busy={busy}
          />
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Belum ada naskah.</p>
        )}
      </section>

      {scenes.length > 0 && (
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Thumbnail</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Dibuat otomatis saat render dari adegan paling visual. Teks besar sebaiknya 2–4 kata dan berbeda dari
              judul.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-[1fr_320px]">
            <ThumbnailPreview props={buildThumbnailProps(props, project)} />
            <form
              action={saveThumbnailText.bind(null, project.id)}
              key={project.thumbnailText ?? ""}
              className="space-y-2"
            >
              <label className="block text-sm font-medium">
                Teks thumbnail
                <input
                  name="thumbnailText"
                  defaultValue={project.thumbnailText ?? ""}
                  placeholder={props.title.split(/\s+/).slice(0, 4).join(" ")}
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-1.5 text-sm dark:border-zinc-700"
                />
              </label>
              <SubmitButton variant="secondary" size="sm" pendingText="Menyimpan...">
                Simpan
              </SubmitButton>
            </form>
          </div>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Hasil render</h2>
        {project.videos.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Belum ada video. Render video 10 menit memakan waktu sekitar 10–40 menit, tergantung komputer.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {project.videos.map((video) => (
              <VideoCard key={video.id} video={video} topic={project.topic} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
