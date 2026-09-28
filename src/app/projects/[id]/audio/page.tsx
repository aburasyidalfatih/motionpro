import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { moodLabel } from "@/lib/labels";
import { libraryUrl, listMusic, listSfx, type LibraryTrack } from "@/lib/library";
import { formatDuration } from "@/lib/projects";
import { isSceneJob, type AudioJobInput } from "@/lib/queue";
import { fileUrl } from "@/lib/storage";
import { DEFAULT_VOICE, DEFAULT_VOICE_STYLE, VOICE_SUGGESTIONS } from "@/lib/tts";
import { revoiceScene, saveMusic, saveVoiceSettings, startAudio } from "./actions";

const field = "mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

async function loadProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      scenes: { orderBy: { order: "asc" }, include: { voiceover: true } },
      jobs: { where: { status: { in: ["QUEUED", "RUNNING"] } } },
    },
  });
}

type ProjectData = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

export default async function AudioPage({ params }: PageProps<"/projects/[id]/audio">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  const [music, sfx] = await Promise.all([listMusic(), listSfx()]);
  return (
    <>
      <AutoRefresh active={project.jobs.length > 0} />
      <AudioBody project={project} music={music} sfxCount={sfx.length} />
    </>
  );
}

function AudioBody({ project, music, sfxCount }: { project: ProjectData; music: LibraryTrack[]; sfxCount: number }) {
  const busy = project.jobs.some((j) => !isSceneJob(j.input));
  const revoicing = new Set(project.jobs.map((j) => (j.input as AudioJobInput | null)?.sceneId).filter(Boolean));
  const scenes = project.scenes;

  if (scenes.length === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Voice over dibuat dari naskah.{" "}
        <Link href={`/projects/${project.id}/script`} className="underline">
          Tulis naskah dulu
        </Link>
        .
      </p>
    );
  }

  const voiced = scenes.filter((s) => s.voiceover).length;
  const totalMs = scenes.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const currentTrack = music.find((t) => t.path === project.musicTrack);

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Suara narator</h2>
        <form action={saveVoiceSettings.bind(null, project.id)} className="grid max-w-2xl gap-4">
          <label className="block text-sm font-medium">
            Suara Gemini TTS
            <input
              name="voiceId"
              list="voices"
              defaultValue={project.voiceId ?? DEFAULT_VOICE}
              className={field}
            />
            <datalist id="voices">
              {VOICE_SUGGESTIONS.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.note}
                </option>
              ))}
            </datalist>
          </label>
          <label className="block text-sm font-medium">
            Gaya bicara (tempo, nada, emosi)
            <textarea
              name="voiceStyle"
              rows={2}
              defaultValue={project.voiceStyle ?? DEFAULT_VOICE_STYLE}
              className={field}
            />
          </label>
          <div>
            <SubmitButton variant="secondary" pendingText="Menyimpan...">
              Simpan pengaturan suara
            </SubmitButton>
          </div>
        </form>
        <p className="text-xs text-zinc-500">
          Setelah mengganti suara atau gaya, klik <span className="font-medium">Buat ulang semua</span> agar semua adegan
          memakai suara baru.
        </p>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Voice over per adegan</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {voiced} dari {scenes.length} adegan sudah bersuara · total durasi {formatDuration(totalMs)}
            </p>
          </div>
          <div className="flex gap-2">
            {voiced > 0 && (
              <form action={startAudio.bind(null, project.id, true)}>
                <SubmitButton variant="secondary" disabled={busy} pendingText="Memulai...">
                  Buat ulang semua
                </SubmitButton>
              </form>
            )}
            {voiced < scenes.length && (
              <form action={startAudio.bind(null, project.id, false)}>
                <SubmitButton disabled={busy} pendingText="Memulai...">
                  Buat voice over ({scenes.length - voiced} adegan)
                </SubmitButton>
              </form>
            )}
          </div>
        </div>

        <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {scenes.map((scene, index) => (
            <li key={scene.id} className="grid gap-3 p-3 md:grid-cols-[1fr_320px] md:items-center">
              <div className="text-sm">
                <span className="text-xs text-zinc-500">
                  Adegan {index + 1} · {formatDuration(scene.durationMs ?? 0)}
                  {!scene.voiceover && " (perkiraan)"}
                </span>
                <p className="line-clamp-2">{scene.narration}</p>
              </div>
              <div className="flex items-center gap-2">
                {revoicing.has(scene.id) ? (
                  <span className="flex-1 text-xs text-amber-600">Membuat suara...</span>
                ) : scene.voiceover ? (
                  <audio controls preload="none" src={fileUrl(scene.voiceover.audioPath)} className="h-9 flex-1" />
                ) : (
                  <span className="flex-1 text-xs text-zinc-500">Belum ada suara</span>
                )}
                <form action={revoiceScene.bind(null, scene.id)}>
                  <SubmitButton
                    variant="secondary"
                    size="sm"
                    disabled={busy || revoicing.has(scene.id)}
                    pendingText="..."
                    title="Buat ulang suara adegan ini"
                  >
                    {scene.voiceover ? "Ulang" : "Buat"}
                  </SubmitButton>
                </form>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Musik latar dan efek suara</h2>
        {music.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Library musik masih kosong. Unduh musik dari YouTube Audio Library, lalu simpan di folder{" "}
            <code>library/music/&lt;suasana&gt;/</code>, misalnya <code>library/music/epic/</code>. Lihat{" "}
            <code>library/README.md</code>.
          </p>
        ) : (
          <form
            // Dipasang ulang saat musik dipilih otomatis oleh worker, agar pilihan terbaru tampil.
            key={project.musicTrack ?? "none"}
            action={saveMusic.bind(null, project.id)}
            className="flex max-w-2xl flex-wrap items-end gap-3"
          >
            <label className="block flex-1 text-sm font-medium">
              Musik latar
              <select name="musicTrack" defaultValue={project.musicTrack ?? ""} className={field}>
                <option value="">Tanpa musik</option>
                {music.map((t) => (
                  <option key={t.path} value={t.path}>
                    {moodLabel[t.mood] ?? t.mood} · {t.name}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton variant="secondary" pendingText="Menyimpan...">
              Simpan
            </SubmitButton>
          </form>
        )}
        {currentTrack && (
          <audio controls preload="none" src={libraryUrl(`music/${currentTrack.path}`)} className="w-full max-w-2xl" />
        )}
        <p className="text-xs text-zinc-500">
          Musik otomatis mengecil saat narasi berbicara, dan {sfxCount} efek suara dari <code>library/sfx/</code> dipasang
          di transisi. Keduanya diterapkan saat render.
        </p>
      </section>
    </div>
  );
}
