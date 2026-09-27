import { TitleCardPlayer } from "./TitleCardPlayer";

export default function PreviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pratinjau template</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Kartu judul dari template sejarah, diputar langsung di browser dengan Remotion Player
          tanpa render. Template lengkap (peta animasi, timeline, ken-burns) dibangun di Fase 3.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <TitleCardPlayer />
      </div>
    </div>
  );
}
