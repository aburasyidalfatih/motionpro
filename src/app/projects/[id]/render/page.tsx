import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { ButtonLink, EmptyState, Notice, SectionHeader } from "@/components/ui";
import { VideoCard } from "@/components/VideoCard";
import { needsAsset } from "@/lib/ai/schemas";
import { db } from "@/lib/db";
import { formatDuration } from "@/lib/projects";
import { isSceneJob } from "@/lib/queue";
import { browserUrls, buildVideoProps, projectVideoInclude } from "@/lib/video/props";
import { startRender } from "./actions";
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
        <SectionHeader
          title="Pratinjau"
          description={`${scenes.length} adegan · ${formatDuration(totalMs)}. Pratinjau diputar langsung di browser; hasil render identik, dalam 1920×1080 30 fps.`}
        />

        {!canRender && scenes.length > 0 && (
          <Notice tone="warning" title="Belum bisa dirender">
            {withoutAsset > 0 && (
              <Link href={`/projects/${project.id}/storyboard`} className="font-medium underline underline-offset-2">
                {withoutAsset} adegan tanpa aset
              </Link>
            )}
            {withoutAsset > 0 && withoutVoice > 0 && ", "}
            {withoutVoice > 0 && (
              <Link href={`/projects/${project.id}/audio`} className="font-medium underline underline-offset-2">
                {withoutVoice} adegan tanpa voice over
              </Link>
            )}
            .
          </Notice>
        )}

        {scenes.length > 0 ? (
          <VideoPreview
            props={props}
            renderAction={startRender.bind(null, project.id)}
            canRender={canRender}
            busy={busy}
          />
        ) : (
          <EmptyState
            title="Belum ada naskah"
            description="Pratinjau video muncul setelah naskah ditulis."
            action={<ButtonLink href={`/projects/${project.id}/script`}>Ke tahap naskah</ButtonLink>}
          />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader title="Hasil render" />
        {project.videos.length === 0 ? (
          <EmptyState
            title="Belum ada video"
            description="Render video 10 menit memakan waktu sekitar 10–40 menit, tergantung komputer."
          />
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
