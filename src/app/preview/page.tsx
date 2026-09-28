import { SectionHeader } from "@/components/ui";
import { DemoPlayer } from "./DemoPlayer";

export default function PreviewPage() {
  return (
    <div className="space-y-6">
      <SectionHeader
        as="h1"
        title="Pratinjau template"
        description="Contoh semua tipe adegan grafis (kartu judul, teks kinetik, peta pertempuran, timeline, perbandingan, statistik, kutipan) dengan data contoh Pertempuran Surabaya. Diputar langsung di browser tanpa render, tanpa aset gambar atau video."
      />
      <div className="overflow-hidden rounded-xl border border-border bg-black shadow-sm">
        <DemoPlayer />
      </div>
    </div>
  );
}
