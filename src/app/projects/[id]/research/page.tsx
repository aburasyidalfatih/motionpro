import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { SubmitButton } from "@/components/SubmitButton";
import { db } from "@/lib/db";
import { isSceneRewrite } from "@/lib/queue";
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
  const busy = project.jobs.some((j) => !isSceneRewrite(j.input));
  const brief = project.research;

  if (!brief) {
    // Proyek gagal sudah punya tombol "Coba lagi" di atas.
    if (project.status === "FAILED") return null;
    return busy ? (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Gemini sedang menyusun pertanyaan riset, mencari di Google, lalu merangkum hasilnya. Biasanya 1–3 menit.
      </p>
    ) : (
      <form action={startResearch.bind(null, project.id)} className="space-y-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Proyek ini belum punya riset.</p>
        <SubmitButton pendingText="Memulai...">Mulai riset</SubmitButton>
      </form>
    );
  }

  const questions = brief.questions as string[];
  const suggestions = brief.searchSuggestions as string[];
  const hasScript = project._count.scenes > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {questions.length} pertanyaan riset · {brief.sources.length} sumber. Periksa dan edit brief di bawah;
          naskah hanya akan memakai isi brief ini.
        </p>
        <div className="flex gap-2">
          <form action={startResearch.bind(null, project.id)}>
            <SubmitButton variant="secondary" disabled={busy} pendingText="Memulai...">
              Riset ulang
            </SubmitButton>
          </form>
          <form action={startScript.bind(null, project.id)}>
            <SubmitButton disabled={busy} pendingText="Memulai...">
              {hasScript ? "Tulis ulang naskah" : "Tulis naskah"}
            </SubmitButton>
          </form>
        </div>
      </div>
      {hasScript && (
        <p className="-mt-5 text-xs text-zinc-500">Menulis ulang naskah akan mengganti semua adegan yang ada.</p>
      )}

      <details className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <summary className="cursor-pointer font-medium">Pertanyaan riset</summary>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-zinc-700 dark:text-zinc-300">
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </details>

      <form action={saveBrief.bind(null, project.id)} className="space-y-3">
        <label className="block text-sm font-medium" htmlFor="markdown">
          Research brief
        </label>
        <textarea
          // Dipasang ulang saat brief berubah (riset ulang), agar isinya ikut baru.
          key={brief.updatedAt.toISOString()}
          id="markdown"
          name="markdown"
          defaultValue={brief.markdown}
          rows={28}
          className="w-full rounded-md border border-zinc-300 bg-transparent p-3 font-mono text-sm leading-relaxed dark:border-zinc-700"
        />
        <p className="text-xs text-zinc-500">
          Angka dalam kurung siku, misalnya [3], merujuk ke daftar sumber di bawah.
        </p>
        <SubmitButton disabled={busy} pendingText="Menyimpan...">
          Simpan brief
        </SubmitButton>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Sumber</h2>
        {brief.sources.length === 0 ? (
          <p className="text-sm text-zinc-500">Tidak ada sumber yang dikembalikan pencarian.</p>
        ) : (
          <ol className="space-y-1 text-sm">
            {brief.sources.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span className="text-zinc-500">[{s.position}]</span>
                <a href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Saran pencarian Google</h2>
          <p className="text-xs text-zinc-500">Ditampilkan sesuai ketentuan Grounding with Google Search.</p>
          {suggestions.map((html, i) => (
            <iframe
              key={i}
              title={`Saran pencarian Google ${i + 1}`}
              srcDoc={`<base target="_blank">${html}`}
              sandbox="allow-popups allow-popups-to-escape-sandbox"
              className="h-24 w-full rounded-md border border-zinc-200 dark:border-zinc-800"
            />
          ))}
        </section>
      )}
    </div>
  );
}
