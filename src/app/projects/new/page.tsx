import { NewProjectForm } from "./NewProjectForm";

export default function NewProjectPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Proyek baru</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Setelah proyek dibuat, Gemini langsung meriset topiknya lewat Google Search. Hasilnya berupa
          research brief bersumber yang bisa Anda periksa dan edit sebelum naskah ditulis.
        </p>
      </div>
      <NewProjectForm />
    </div>
  );
}
