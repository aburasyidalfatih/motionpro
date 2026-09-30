import Link from "next/link";
import type { Video } from "@/generated/prisma/client";
import { deleteVideo, startReview } from "@/app/projects/[id]/render/actions";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDuration } from "@/lib/projects";
import type { VideoReview } from "@/lib/video/review";
import { fileUrl } from "@/lib/storage";

function slug(text: string) {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "video"
  );
}

function downloadUrl(key: string, name: string) {
  return `${fileUrl(key)}?download=${encodeURIComponent(name)}`;
}

// F-31: satu video di galeri: putar, unduh MP4 dan SRT, hapus.
export function VideoCard({ video, topic, projectId }: { video: Video; topic: string; projectId?: string }) {
  const name = slug(topic);
  const sizeMb = (Number(video.sizeBytes) / 1_000_000).toFixed(1);
  const review = video.review as VideoReview | null;
  return (
    <li className="space-y-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <video
        controls
        preload="none"
        poster={video.thumbnailKey ? fileUrl(video.thumbnailKey) : undefined}
        src={fileUrl(video.storageKey)}
        className="aspect-video w-full rounded-md bg-black"
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          {projectId ? (
            <Link href={`/projects/${projectId}/render`} className="font-medium hover:underline">
              {topic}
            </Link>
          ) : (
            <div className="font-medium">{topic}</div>
          )}
          <div className="text-xs text-zinc-500">
            {formatDuration(video.durationMs)} · {video.width}×{video.height} · {video.fps} fps · {sizeMb} MB ·{" "}
            {video.createdAt.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <a
            href={downloadUrl(video.storageKey, `${name}.mp4`)}
            className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Unduh MP4
          </a>
          {video.srtKey && (
            <a
              href={downloadUrl(video.srtKey, `${name}.srt`)}
              className="rounded-md border border-zinc-300 px-3 py-1.5 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              SRT
            </a>
          )}
          <form action={startReview.bind(null, video.id)}>
            <SubmitButton
              variant="secondary"
              size="sm"
              pendingText="Memulai..."
              title="Gemini memeriksa satu frame per adegan: teks terpotong atau bertumpuk, layar kosong, salah ketik"
            >
              {video.review ? "Periksa ulang" : "Periksa dengan AI"}
            </SubmitButton>
          </form>
          <form action={deleteVideo.bind(null, video.id)}>
            <SubmitButton variant="danger" size="sm" pendingText="Menghapus...">
              Hapus
            </SubmitButton>
          </form>
        </div>
      </div>
      {review && (
        <details className="text-sm" open={review.issues.length > 0}>
          <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
            Pemeriksaan AI: {review.issues.length === 0 ? "tidak ada masalah" : `${review.issues.length} catatan`}
          </summary>
          <ul className="mt-2 space-y-1.5">
            {review.issues.map((issue, i) => (
              <li key={i} className="text-xs">
                <span
                  className={
                    issue.severity === "tinggi"
                      ? "font-medium text-red-600"
                      : issue.severity === "sedang"
                        ? "font-medium text-amber-600"
                        : "font-medium text-zinc-500"
                  }
                >
                  Adegan {issue.scene + 1} ({formatDuration(issue.timeMs)}):
                </span>{" "}
                {issue.problem} <span className="text-zinc-500">→ {issue.fix}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {video.chapters && (
        <details className="text-sm">
          <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">
            Chapter YouTube (salin ke deskripsi video)
          </summary>
          <textarea
            readOnly
            value={video.chapters}
            rows={Math.min(12, video.chapters.split("\n").length)}
            className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent p-2 font-mono text-xs dark:border-zinc-700"
          />
        </details>
      )}
    </li>
  );
}
