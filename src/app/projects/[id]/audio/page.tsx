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
import {
  DEFAULT_VOICE,
  DEFAULT_VOICE_STYLE,
  isOutdatedVoiceover,
  listVoiceSamples,
  projectVoice,
  VOICE_STYLE_EXAMPLE,
  VOICE_STYLE_PRESETS,
  VOICES,
  voiceSamplePath,
} from "@/lib/tts";
import type { Voice } from "@/lib/tts/voices";
import { revoiceScene, saveMusic, saveVoiceSettings, startAudio, startVoiceSamples } from "./actions";
import { VoicePicker } from "./VoicePicker";
import { VoiceStyleField } from "./VoiceStyleField";

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

// Contoh suara yang sudah ada dan job pembuatannya yang terakhir.
async function loadVoiceSamples() {
  const [existing, job] = await Promise.all([
    listVoiceSamples(),
    db.jobRun.findFirst({ where: { kind: "VOICE_SAMPLES" }, orderBy: { createdAt: "desc" } }),
  ]);
  const urls = Object.fromEntries([...existing].map((name) => [name, fileUrl(voiceSamplePath(name))]));
  const missing = VOICES.filter((v) => !existing.has(v.name)).length;
  return { urls, missing, job };
}

type VoiceSamples = Awaited<ReturnType<typeof loadVoiceSamples>>;

export default async function AudioPage({ params }: PageProps<"/projects/[id]/audio">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  const [music, sfx, samples] = await Promise.all([listMusic(), listSfx(), loadVoiceSamples()]);
  const samplesRunning = samples.job?.status === "QUEUED" || samples.job?.status === "RUNNING";
  return (
    <>
      <AutoRefresh active={project.jobs.length > 0 || samplesRunning} />
      <AudioBody project={project} music={music} sfxCount={sfx.length} samples={samples} />
    </>
  );
}

function AudioBody({
  project,
  music,
  sfxCount,
  samples,
}: {
  project: ProjectData;
  music: LibraryTrack[];
  sfxCount: number;
  samples: VoiceSamples;
}) {
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
  // Adegan yang suaranya dibuat dengan suara atau gaya bicara lain dari pengaturan sekarang.
  const narrator = projectVoice(project);
  const outdated = new Set(
    scenes.filter((s) => s.voiceover && isOutdatedVoiceover(s.voiceover, narrator)).map((s) => s.id),
  );
  const totalMs = scenes.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
  const currentTrack = music.find((t) => t.path === project.musicTrack);
  const currentVoice = project.voiceId ?? DEFAULT_VOICE;
  // Suara lama yang diketik manual dan tidak ada di daftar tetap bisa dipilih.
  const voiceOptions: Voice[] = VOICES.some((v) => v.name === currentVoice)
    ? VOICES
    : [...VOICES, { name: currentVoice, gender: "pria", note: "diisi manual" }];

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Suara narator</h2>
        <VoiceSampleStatus samples={samples} />
        <form action={saveVoiceSettings.bind(null, project.id)} className="grid max-w-4xl gap-5">
          <div className="text-sm font-medium">
            Suara Gemini TTS
            <div className="mt-2 font-normal">
              <VoicePicker voices={voiceOptions} defaultValue={currentVoice} samples={samples.urls} />
            </div>
          </div>
          {/* Bukan <label> pembungkus: klik pada label akan menekan tombol preset pertama. */}
          <div className="max-w-2xl text-sm font-medium">
            <label htmlFor="voiceStyle">Gaya bicara (opsional)</label>
            <VoiceStyleField
              id="voiceStyle"
              defaultValue={project.voiceStyle ?? DEFAULT_VOICE_STYLE}
              presets={VOICE_STYLE_PRESETS}
              placeholder={`Misalnya: ${VOICE_STYLE_EXAMPLE}`}
              className={field}
            />
            <span className="mt-1 block text-xs font-normal text-zinc-500">
              Pilih preset atau tulis sendiri; kosongkan agar narasi dibacakan apa adanya. Instruksi gaya kadang ikut
              terbaca; bila terdeteksi, adegan itu dicoba ulang, dan baru dibacakan tanpa instruksi bila masih terbaca.
            </span>
          </div>
          <div>
            <SubmitButton variant="secondary" pendingText="Menyimpan...">
              Simpan pengaturan suara
            </SubmitButton>
          </div>
        </form>
        <p className="text-xs text-zinc-500">
          Setelah mengganti suara atau gaya, klik <span className="font-medium">Samakan</span> di bawah agar semua
          adegan memakai suara yang sama. Volume tiap adegan disamakan otomatis.
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
            {outdated.size > 0 && (
              <form action={startAudio.bind(null, project.id, "outdated")}>
                <SubmitButton disabled={busy} pendingText="Memulai...">
                  Samakan {outdated.size} adegan
                </SubmitButton>
              </form>
            )}
            {voiced > 0 && (
              <form action={startAudio.bind(null, project.id, "all")}>
                <SubmitButton variant="secondary" disabled={busy} pendingText="Memulai...">
                  Buat ulang semua
                </SubmitButton>
              </form>
            )}
            {voiced < scenes.length && (
              <form action={startAudio.bind(null, project.id, "missing")}>
                <SubmitButton disabled={busy} pendingText="Memulai...">
                  Buat voice over ({scenes.length - voiced} adegan)
                </SubmitButton>
              </form>
            )}
          </div>
        </div>

        {outdated.size > 0 && (
          <p className="rounded-md border border-amber-300 p-3 text-sm text-amber-700 dark:border-amber-800 dark:text-amber-400">
            {outdated.size} adegan dibuat dengan suara atau gaya bicara yang berbeda dari pengaturan sekarang, jadi
            narasinya terdengar tidak konsisten. Klik <span className="font-medium">Samakan</span> untuk membuat ulang
            adegan itu saja.
          </p>
        )}

        <ol className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {scenes.map((scene, index) => (
            <li key={scene.id} className="grid gap-3 p-3 md:grid-cols-[1fr_320px] md:items-center">
              <div className="text-sm">
                <span className="text-xs text-zinc-500">
                  Adegan {index + 1} · {formatDuration(scene.durationMs ?? 0)}
                  {!scene.voiceover && " (perkiraan)"}
                </span>
                {scene.voiceover && outdated.has(scene.id) && (
                  <span className="ml-2 text-xs text-amber-600">
                    suara lain: {scene.voiceover.voiceId}
                    {scene.voiceover.voiceStyle ? ` · ${scene.voiceover.voiceStyle}` : ""}
                  </span>
                )}
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
            <label className="flex w-full items-center gap-2 text-sm">
              <input type="checkbox" name="musicPerChapter" defaultChecked={project.musicPerChapter} />
              Ganti musik tiap bab sesuai suasananya (musik di atas untuk pembuka)
            </label>
          </form>
        )}
        {currentTrack && (
          <audio controls preload="none" src={libraryUrl(`music/${currentTrack.path}`)} className="w-full max-w-2xl" />
        )}
        <p className="text-xs text-zinc-500">
          Musik otomatis mengecil saat narasi berbicara, dan {sfxCount} efek suara dari <code>library/sfx/</code>{" "}
          dipasang di transisi, kartu bab, peta, dan saat angka muncul. Keduanya diterapkan saat render.
        </p>
      </section>
    </div>
  );
}

function VoiceSampleStatus({ samples }: { samples: VoiceSamples }) {
  const { job, missing } = samples;
  if (job?.status === "QUEUED" || job?.status === "RUNNING") {
    return <p className="text-sm text-amber-600">Membuat contoh suara... {job.progress}%</p>;
  }
  if (missing === 0) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Klik ▶ untuk mendengar contoh suara (dibacakan tanpa gaya bicara).
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
      <span>
        {missing} dari {VOICES.length} suara belum punya contoh. Contoh dibuat sekali lalu dipakai semua proyek.
      </span>
      <form action={startVoiceSamples}>
        <SubmitButton variant="secondary" size="sm" pendingText="Memulai...">
          Buat contoh suara
        </SubmitButton>
      </form>
      {job?.status === "FAILED" && <span className="w-full text-xs text-red-600">Gagal: {job.error}</span>}
    </div>
  );
}
