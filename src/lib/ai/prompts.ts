import type { NumberedSource, ProjectBrief, ResearchNote } from "./types";
import type { SceneDraft } from "./schemas";

// Kecepatan bicara narator Bahasa Indonesia yang dipakai untuk perkiraan durasi.
export const WORDS_PER_MINUTE = 130;

const languageName = (code: string) => (code === "en" ? "bahasa Inggris" : "Bahasa Indonesia");

export const SYSTEM_PROMPT = `Kamu adalah peneliti dan penulis naskah untuk channel YouTube dokumenter sejarah
bergaya Kings and Generals dan Epic History TV: akurat, sinematik, memakai peta dan lukisan sejarah.
Utamakan sumber tepercaya (jurnal, arsip, museum, ensiklopedia, media besar).
Jangan mengarang fakta, tanggal, atau angka.`;

export function planPrompt(p: ProjectBrief) {
  return `Topik video: "${p.topic}".
Durasi target: ${p.targetMinutes} menit. Gaya: ${p.tone}.

Susun 5–8 pertanyaan riset yang bersama-sama cukup untuk menulis naskah dokumenter yang akurat:
latar belakang, tokoh kunci, kronologi, lokasi dan geografi, sebab-akibat, dampak, serta fakta yang jarang diketahui.
Tulis pertanyaan dalam ${languageName(p.language)}.`;
}

export function researchPrompt(p: ProjectBrief, question: string) {
  return `Riset untuk video dokumenter sejarah tentang "${p.topic}".
Pertanyaan: ${question}

Jawab secara faktual dan rinci dalam ${languageName(p.language)}: sertakan tanggal, angka, nama tempat
beserta lokasinya, dan nama tokoh. Sebutkan bila sumber-sumber berbeda pendapat.`;
}

export function briefPrompt(p: ProjectBrief, notes: ResearchNote[], sources: NumberedSource[]) {
  const sourceList = sources.map((s) => `[${s.position}] ${s.title} — ${s.url}`).join("\n");
  const noteText = notes
    .map((n, i) => {
      const refs = n.sources
        .map((s) => sources.find((x) => x.url === s.url)?.position)
        .filter((x): x is number => x !== undefined)
        .map((x) => `[${x}]`)
        .join(" ");
      return `### Catatan ${i + 1}: ${n.question}\nSumber: ${refs || "-"}\n${n.text}`;
    })
    .join("\n\n");

  return `Susun research brief untuk video dokumenter "${p.topic}" (${p.targetMinutes} menit) dalam ${languageName(p.language)}.
Gunakan HANYA informasi dari catatan riset di bawah. Setiap fakta harus mencantumkan nomor sumber
dari daftar sumber; jangan memakai nomor yang tidak ada di daftar.

Daftar sumber:
${sourceList || "(tidak ada)"}

Catatan riset:
${noteText}`;
}

export function scriptPrompt(p: ProjectBrief, briefMarkdown: string) {
  const words = p.targetMinutes * WORDS_PER_MINUTE;
  const scenes = Math.max(3, Math.round(p.targetMinutes * 6));
  return `Tulis naskah video dokumenter sejarah "${p.topic}" dalam ${languageName(p.language)}, gaya ${p.tone}.

Aturan:
- Total narasi sekitar ${words} kata (${p.targetMinutes} menit), dibagi menjadi sekitar ${scenes} adegan
  (tiap adegan 1–3 kalimat, sekitar 8–15 detik).
- Adegan pertama adalah hook yang kuat dalam 10 detik pertama; tutup dengan kesimpulan yang berkesan.
- Gunakan HANYA fakta dari research brief di bawah. Jangan menambah fakta baru.
- visualType: "title" untuk kartu judul, "map" bila adegan membahas lokasi, wilayah, atau pergerakan
  (isi map dengan koordinat lat/lng yang benar), "painting" untuk lukisan sejarah, "archival_photo" untuk
  foto arsip (hanya untuk era fotografi, setelah sekitar 1840), "timeline" untuk kronologi,
  "footage" untuk suasana (laut, hutan, reruntuhan).
- Isi timeline pada adegan yang menandai tanggal penting.
- keywords dalam bahasa Inggris, spesifik untuk mencari lukisan/arsip/footage (contoh: "Majapahit temple ruins",
  "Dutch East India Company ship painting").
- onScreenText singkat (maksimal 8 kata) atau string kosong.

Research brief:
${briefMarkdown}`;
}

export function rewritePrompt(input: {
  project: ProjectBrief;
  briefMarkdown: string;
  scene: SceneDraft;
  previous?: string;
  next?: string;
  instruction: string;
}) {
  return `Tulis ulang SATU adegan naskah video dokumenter "${input.project.topic}" dalam ${languageName(input.project.language)}.
Instruksi dari penulis: ${input.instruction || "perbaiki agar lebih kuat dan mengalir"}

Narasi adegan sebelumnya: ${input.previous ?? "(tidak ada, ini adegan pertama)"}
Adegan saat ini (JSON): ${JSON.stringify(input.scene)}
Narasi adegan berikutnya: ${input.next ?? "(tidak ada, ini adegan terakhir)"}

Pertahankan panjang yang mirip dan alur dengan adegan sebelum dan sesudahnya.
Gunakan HANYA fakta dari research brief:
${input.briefMarkdown}`;
}
