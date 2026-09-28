import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { Badge, ButtonLink, Card, EmptyState, FieldLabel, Notice, ProgressBar, SectionHeader } from "@/components/ui";
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
      <EmptyState
        title="Voice over dibuat dari naskah"
        description="Setelah naskah ditulis, setiap adegan dibacakan oleh narator pilihan Anda."
        action={<ButtonLink href={`/projects/${project.id}/script`}>Ke tahap naskah</ButtonLink>}
      />
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
    <div className="space-y-8">
      <Card>
        <div className="space-y-1 border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">Suara narator</h2>
          <VoiceSampleStatus samples={samples} />
        </div>
        <form action={saveVoiceSettings.bind(null, project.id)} className="space-y-6 px-5 py-5">
          <VoicePicker voices={voiceOptions} defaultValue={currentVoice} samples={samples.urls} />
          {/* Bukan <label> pembungkus: klik pada label akan menekan tombol preset pertama. */}
          <div className="max-w-2xl">
            <FieldLabel htmlFor="voiceStyle">Gaya bicara (opsional)</FieldLabel>
            <VoiceStyleField
              id="voiceStyle"
              defaultValue={project.voiceStyle ?? DEFAULT_VOICE_STYLE}
              presets={VOICE_STYLE_PRESETS}
              placeholder={`Misalnya: ${VOICE_STYLE_EXAMPLE}`}
              className="field mt-2"
            />
            <p className="mt-1.5 text-xs leading-relaxed text-muted">
              Pilih preset atau tulis sendiri; kosongkan agar narasi dibacakan apa adanya. Instruksi gaya kadang ikut
              terbaca; bila terdeteksi, adegan itu dicoba ulang, dan baru dibacakan tanpa instruksi bila masih terbaca.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-xs text-muted">
              Setelah mengganti suara atau gaya, klik <span className="font-medium text-foreground">Samakan</span> di
              bawah. Volume tiap adegan disamakan otomatis.
            </p>
            <SubmitButton pendingText="Menyimpan...">Simpan pengaturan suara</SubmitButton>
          </div>
        </form>
      </Card>

      <section className="space-y-4">
        <SectionHeader
          title="Voice over per adegan"
          description={`${voiced} dari ${scenes.length} adegan sudah bersuara · total durasi ${formatDuration(totalMs)}`}
          actions={
            <>
              {voiced > 0 && (
                <form action={startAudio.bind(null, project.id, "all")}>
                  <SubmitButton variant="secondary" disabled={busy} pendingText="Memulai...">
                    Buat ulang semua
                  </SubmitButton>
                </form>
              )}
              {outdated.size > 0 && (
                <form action={startAudio.bind(null, project.id, "outdated")}>
                  <SubmitButton disabled={busy} pendingText="Memulai...">
                    Samakan {outdated.size} adegan
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
            </>
          }
        />

        {outdated.size > 0 && (
          <Notice tone="warning" title={`${outdated.size} adegan memakai suara atau gaya bicara lain`}>
            Narasinya terdengar tidak konsisten dengan adegan lain. Klik <span className="font-medium">Samakan</span>{" "}
            untuk membuat ulang adegan itu saja.
          </Notice>
        )}

        <Card>
          <ol className="divide-y divide-border">
            {scenes.map((scene, index) => (
              <li key={scene.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1fr)_340px] md:items-center">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[11px] font-semibold tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0 space-y-1 text-sm">
                    <p className="line-clamp-2 leading-relaxed">{scene.narration}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="tabular-nums">
                        {formatDuration(scene.durationMs ?? 0)}
                        {!scene.voiceover && " (perkiraan)"}
                      </span>
                      {scene.voiceover && outdated.has(scene.id) && (
                        <Badge tone="warning">
                          suara lain: {scene.voiceover.voiceId}
                          {scene.voiceover.voiceStyle ? ` · ${scene.voiceover.voiceStyle}` : ""}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {revoicing.has(scene.id) ? (
                    <span className="flex flex-1 items-center gap-2 text-xs text-accent">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-accent" aria-hidden />
                      Membuat suara...
                    </span>
                  ) : scene.voiceover ? (
                    <audio
                      controls
                      preload="none"
                      src={fileUrl(scene.voiceover.audioPath)}
                      className="h-9 min-w-0 flex-1"
                    />
                  ) : (
                    <span className="flex-1 text-xs text-muted">Belum ada suara</span>
                  )}
                  <form action={revoiceScene.bind(null, scene.id)}>
                    <SubmitButton
                      variant="secondary"
                      size="sm"
                      disabled={busy || revoicing.has(scene.id)}
                      pendingText="…"
                      title="Buat ulang suara adegan ini"
                    >
                      {scene.voiceover ? "Ulang" : "Buat"}
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <Card className="space-y-4 px-5 py-5">
        <SectionHeader
          title="Musik latar dan efek suara"
          description={`Musik otomatis mengecil saat narasi berbicara, dan ${sfxCount} efek suara dari library/sfx/ dipasang di transisi. Keduanya diterapkan saat render.`}
        />
        {music.length === 0 ? (
          <Notice tone="info" title="Library musik masih kosong">
            Unduh musik dari YouTube Audio Library, lalu simpan di folder <code>library/music/&lt;suasana&gt;/</code>,
            misalnya <code>library/music/epic/</code>. Lihat <code>library/README.md</code>.
          </Notice>
        ) : (
          <form
            // Dipasang ulang saat musik dipilih otomatis oleh worker, agar pilihan terbaru tampil.
            key={project.musicTrack ?? "none"}
            action={saveMusic.bind(null, project.id)}
            className="flex max-w-2xl flex-wrap items-end gap-3"
          >
            <div className="min-w-60 flex-1">
              <FieldLabel htmlFor="musicTrack">Musik latar</FieldLabel>
              <select id="musicTrack" name="musicTrack" defaultValue={project.musicTrack ?? ""} className="field">
                <option value="">Tanpa musik</option>
                {music.map((t) => (
                  <option key={t.path} value={t.path}>
                    {moodLabel[t.mood] ?? t.mood} · {t.name}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton variant="secondary" pendingText="Menyimpan...">
              Simpan
            </SubmitButton>
          </form>
        )}
        {currentTrack && (
          <audio controls preload="none" src={libraryUrl(`music/${currentTrack.path}`)} className="w-full max-w-2xl" />
        )}
      </Card>

      <div className="flex justify-end">
        <ButtonLink href={`/projects/${project.id}/render`}>Lanjut ke render →</ButtonLink>
      </div>
    </div>
  );
}

function VoiceSampleStatus({ samples }: { samples: VoiceSamples }) {
  const { job, missing } = samples;
  if (job?.status === "QUEUED" || job?.status === "RUNNING") {
    return (
      <div className="flex max-w-sm items-center gap-3 text-sm text-muted">
        <span>Membuat contoh suara...</span>
        <ProgressBar value={job.progress} className="flex-1" />
        <span className="tabular-nums">{job.progress}%</span>
      </div>
    );
  }
  if (missing === 0) {
    return <p className="text-sm text-muted">Klik ▶ untuk mendengar contoh suara (dibacakan tanpa gaya bicara).</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
      <span>
        {missing} dari {VOICES.length} suara belum punya contoh. Contoh dibuat sekali lalu dipakai semua proyek.
      </span>
      <form action={startVoiceSamples}>
        <SubmitButton variant="secondary" size="sm" pendingText="Memulai...">
          Buat contoh suara
        </SubmitButton>
      </form>
      {job?.status === "FAILED" && (
        <span className="w-full text-xs text-red-600 dark:text-red-400">Gagal: {job.error}</span>
      )}
    </div>
  );
}
