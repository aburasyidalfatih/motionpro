import { DemoPlayer } from "./DemoPlayer";

export default function PreviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Pratinjau template</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Contoh semua tipe adegan grafis (kartu judul dan bab, teks kinetik, peta pertempuran, timeline, perbandingan,
          profil tokoh, grafik batang, statistik, kutipan) dengan data contoh Pertempuran Surabaya. Elemen muncul
          mengikuti narasi. Diputar langsung di browser tanpa render, tanpa aset gambar atau video.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <DemoPlayer />
      </div>
    </div>
  );
}
