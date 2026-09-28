import Link from "next/link";
import { Card, SectionHeader } from "@/components/ui";
import { NewProjectForm } from "./NewProjectForm";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/" className="text-xs text-muted hover:text-foreground">
        ← Semua proyek
      </Link>
      <SectionHeader
        as="h1"
        title="Proyek baru"
        description="Topik sejarah militer atau geopolitik. Setelah proyek dibuat, Gemini langsung meriset topiknya lewat Google Search. Hasilnya berupa research brief bersumber yang bisa Anda periksa dan edit sebelum naskah ditulis."
      />
      <Card className="p-5 sm:p-6">
        <NewProjectForm />
      </Card>
    </div>
  );
}
