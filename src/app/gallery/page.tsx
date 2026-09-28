import { connection } from "next/server";
import { ButtonLink, EmptyState, SectionHeader } from "@/components/ui";
import { VideoCard } from "@/components/VideoCard";
import { db } from "@/lib/db";

// F-31: semua video yang sudah dirender, terbaru di atas.
export default async function GalleryPage() {
  await connection();
  const videos = await db.video.findMany({
    orderBy: { createdAt: "desc" },
    include: { project: { select: { id: true, topic: true } } },
    take: 100,
  });

  return (
    <div className="space-y-8">
      <SectionHeader
        as="h1"
        title="Galeri"
        description="Video yang sudah dirender, siap diunduh. Unggah ke YouTube hadir di Fase 4."
      />
      {videos.length === 0 ? (
        <EmptyState
          title="Belum ada video"
          description="Render video dari tab Render di halaman proyek; hasilnya muncul di sini."
          action={
            <ButtonLink href="/" variant="secondary">
              Buka proyek
            </ButtonLink>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {videos.map((video) => (
            <VideoCard key={video.id} video={video} topic={video.project.topic} projectId={video.project.id} />
          ))}
        </ul>
      )}
    </div>
  );
}
