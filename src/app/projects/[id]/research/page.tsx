import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, EmptyState, SectionHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { isSceneJob } from "@/lib/queue";
import { saveBrief, startResearch, startScript } from "../actions";

async function loadProject(id: string) {
  return db.project.findUnique({
    where: { id },
    include: {
      research: { include: { sources: { orderBy: { position: "asc" } } } },
      jobs: { where: { status: { in: ["QUEUED", "RUNNING"] } } },
      _count: { select: { scenes: true } },
    },
  });
}

type ProjectData = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

export default async function ResearchPage({ params }: PageProps<"/projects/[id]/research">) {
  const { id } = await params;
  const project = await loadProject(id);
  if (!project) notFound();
  // Polling ada di halaman, bukan di layout: layout tidak di-render ulang saat
  // berpindah tab di dalam proyek yang sama.
  return (
    <>
      <AutoRefresh active={project.jobs.length > 0} />
      <ResearchBody project={project} />
    </>
  );
}

function ResearchBody({ project }: { project: ProjectData }) {
  const busy = project.jobs.some((j) => !isSceneJob(j.input));
  const brief = project.research;

  if (!brief) {
    // Proyek gagal sudah punya tombol "Coba lagi" di atas.
    if (project.status === "FAILED") return null;
    return busy ? (
      <EmptyState
        title="Gemini sedang meriset"
        description="Menyusun pertanyaan riset, mencari di Google, lalu merangkum hasilnya menjadi brief bersumber. Biasanya 1–3 menit."
      />
    ) : (
      <EmptyState
        title="Belum ada riset"
        description="Riset menghasilkan research brief bersumber yang menjadi satu-satunya dasar naskah."
        action={
          <form action={startResearch.bind(null, project.id)}>
            <SubmitButton pendingText="Memulai...">Mulai riset</SubmitButton>
          </form>
        }
      />
    );
  }

  const questions = brief.questions as string[];
  const suggestions = brief.searchSuggestions as string[];
  const hasScript = project._count.scenes > 0;

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Research brief"
        description={
          <>
            {questions.length} pertanyaan riset · {brief.sources.length} sumber. Periksa dan edit brief; naskah hanya
            memakai isi brief ini.{hasScript && " Menulis ulang naskah mengganti semua adegan yang ada."}
          </>
        }
        actions={
          <>
            <form action={startResearch.bind(null, project.id)}>
              <SubmitButton variant="secondary" disabled={busy} pendingText="Memulai...">
                Riset ulang
              </SubmitButton>
            </form>
            <form action={startScript.bind(null, project.id)}>
              <SubmitButton disabled={busy} pendingText="Memulai...">
                {hasScript ? "Tulis ulang naskah" : "Tulis naskah →"}
              </SubmitButton>
            </form>
          </>
        }
      />

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="p-4 sm:p-5">
          <form action={saveBrief.bind(null, project.id)} className="space-y-3">
            <textarea
              // Dipasang ulang saat brief berubah (riset ulang), agar isinya ikut baru.
              key={brief.updatedAt.toISOString()}
              id="markdown"
              name="markdown"
              aria-label="Research brief"
              defaultValue={brief.markdown}
              rows={30}
              className="field font-mono text-[13px] leading-relaxed"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted">Angka dalam kurung siku, misalnya [3], merujuk ke daftar sumber.</p>
              <SubmitButton disabled={busy} pendingText="Menyimpan...">
                Simpan brief
              </SubmitButton>
            </div>
          </form>
        </Card>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <Card className="p-4">
            <details open={questions.length <= 6}>
              <summary className="cursor-pointer text-sm font-semibold">Pertanyaan riset ({questions.length})</summary>
              <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-muted">
                {questions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </details>
          </Card>

          <Card className="p-4">
            <h2 className="text-sm font-semibold">Sumber ({brief.sources.length})</h2>
            {brief.sources.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Tidak ada sumber yang dikembalikan pencarian.</p>
            ) : (
              <ol className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1 text-sm">
                {brief.sources.map((s) => (
                  <li key={s.id} className="flex gap-2">
                    <span className="shrink-0 text-xs text-muted tabular-nums">[{s.position}]</span>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      className="break-words text-foreground underline decoration-border underline-offset-2 hover:decoration-accent"
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            )}
          </Card>

          {suggestions.length > 0 && (
            <Card className="space-y-2 p-4">
              <h2 className="text-sm font-semibold">Saran pencarian Google</h2>
              <p className="text-xs text-muted">Ditampilkan sesuai ketentuan Grounding with Google Search.</p>
              {suggestions.map((html, i) => (
                <iframe
                  key={i}
                  title={`Saran pencarian Google ${i + 1}`}
                  srcDoc={`<base target="_blank">${html}`}
                  sandbox="allow-popups allow-popups-to-escape-sandbox"
                  className="h-24 w-full rounded-lg border border-border bg-white"
                />
              ))}
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
