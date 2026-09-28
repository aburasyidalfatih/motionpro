import { connection } from "next/server";
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Galeri</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Video yang sudah dirender, siap diunduh. Unggah ke YouTube hadir di Fase 4.
        </p>
      </div>
      {videos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
          Belum ada video. Render video dari tab <span className="font-medium">Render</span> di halaman proyek.
        </div>
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
