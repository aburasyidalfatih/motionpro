import type { NumberedSource, ProjectBrief, RankingScene, ResearchNote } from "./types";
import type { SceneDraft } from "./schemas";

// Kecepatan bicara narator Bahasa Indonesia yang dipakai untuk perkiraan durasi.
export const WORDS_PER_MINUTE = 130;

const languageName = (code: string) => (code === "en" ? "bahasa Inggris" : "Bahasa Indonesia");

export const SYSTEM_PROMPT = `Kamu adalah peneliti dan penulis naskah untuk channel YouTube sejarah militer dan
geopolitik: pertempuran, perang, strategi, kekuatan militer, perebutan wilayah, dan hubungan antarnegara, dari
sejarah Nusantara hingga isu global terkini. Gayanya seperti Kings and Generals, RealLifeLore, dan Caspian Report:
akurat, analitis, bercerita, dan kaya peta, angka, serta perbandingan.
Utamakan sumber tepercaya (jurnal, arsip, lembaga riset pertahanan, data resmi, ensiklopedia, media besar).
Jangan mengarang fakta, tanggal, angka, atau koordinat.`;

export function planPrompt(p: ProjectBrief) {
  return `Topik video: "${p.topic}".
Durasi target: ${p.targetMinutes} menit. Gaya: ${p.tone}.

Susun 5–8 pertanyaan riset yang bersama-sama cukup untuk menulis naskah yang akurat: latar belakang, pihak-pihak
yang terlibat dan kepentingannya, kronologi, lokasi dan geografi (termasuk pergerakan pasukan atau jalur penting),
kekuatan masing-masing pihak dalam angka, strategi, dampak, serta fakta yang jarang diketahui.
Untuk topik geopolitik terkini, sertakan pertanyaan tentang data dan perkembangan terbaru.
Tulis pertanyaan dalam ${languageName(p.language)}.`;
}

export function researchPrompt(p: ProjectBrief, question: string) {
  return `Riset untuk video sejarah militer dan geopolitik tentang "${p.topic}".
Pertanyaan: ${question}

Jawab secara faktual dan rinci dalam ${languageName(p.language)}: sertakan tanggal, angka (jumlah pasukan,
korban, anggaran, luas wilayah, dan sejenisnya), nama tempat beserta lokasinya, dan nama tokoh.
Sebutkan tahun data untuk angka terkini, dan sebutkan bila sumber-sumber berbeda pendapat.`;
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

const GRAPHIC_TYPES_GUIDE = `- "title": kartu judul (adegan pertama atau pembuka bab). onScreenText = judul.
- "kinetic_text": kalimat kunci ditampilkan besar. Isi kinetic.lines (1–3 baris pendek, maksimal 6 kata per baris,
  diambil dari inti narasi) dan kinetic.emphasis (1–3 kata terpenting dari lines).
- "map": adegan tentang lokasi, wilayah, pergerakan pasukan, jalur, atau posisi negara. Isi map dengan koordinat
  lat/lng yang benar. Untuk konflik isi map.sides (nama pihak), points[].side, map.arrows (gerak pasukan/armada dari
  indeks titik ke indeks titik) dan map.zones (wilayah kekuasaan, radiusKm) bila relevan.
- "timeline": kronologi beberapa peristiwa. Isi events (2–7 peristiwa: date singkat seperti "1825" atau "10 Nov",
  label maksimal 5 kata). onScreenText = judul timeline. Hanya satu tanggal? Jangan pakai "timeline": pakai
  "kinetic_text" dan isi timeline (penanda tanggal di pojok layar).
- "stat": angka penting. Isi stats (1–3 angka dengan label singkat; prefix/suffix bila perlu, misalnya "%", " km",
  "US$"). onScreenText = judul singkat.
- "comparison": perbandingan dua pihak (kekuatan militer, ekonomi, strategi). Isi comparison.left/right dan
  rows (2–5 aspek); isi leftValue/rightValue bila angkanya bisa dibandingkan.
- "quote": kutipan tokoh atau dokumen yang benar-benar ada di brief. Isi quote.text dan quote.source.`;

const ARCHIVAL_TYPES_GUIDE = `- "painting": lukisan sejarah; "archival_photo": foto arsip (hanya setelah sekitar 1840);
  "footage": suasana (laut, hutan, kota, reruntuhan). Untuk ketiganya isi keywords dalam bahasa Inggris yang
  spesifik untuk mencari aset (contoh: "Diponegoro painting", "Dutch colonial army 1830").`;

export function scriptPrompt(p: ProjectBrief, briefMarkdown: string) {
  const words = p.targetMinutes * WORDS_PER_MINUTE;
  const scenes = Math.max(3, Math.round(p.targetMinutes * 6));
  const graphicOnly = p.style === "GRAPHIC";
  return `Tulis naskah video "${p.topic}" dalam ${languageName(p.language)}, gaya ${p.tone}.

Aturan:
- Total narasi sekitar ${words} kata (${p.targetMinutes} menit), dibagi menjadi sekitar ${scenes} adegan
  (tiap adegan 1–3 kalimat, sekitar 8–15 detik).
- Adegan pertama adalah hook yang kuat dalam 10 detik pertama; tutup dengan kesimpulan yang berkesan.
- Gunakan HANYA fakta dari research brief di bawah. Jangan menambah fakta, angka, atau kutipan baru.
- ${graphicOnly ? "Video ini FULL GRAFIS: hanya pakai visualType grafis di bawah, jangan pakai painting, archival_photo, atau footage." : "Campur adegan grafis dengan lukisan, foto arsip, dan footage; pakai grafis untuk peta, angka, kronologi, dan perbandingan."}
- Variasikan visualType; jangan pakai tipe yang sama lebih dari 2 adegan berturut-turut. Utamakan "map" untuk
  pergerakan dan lokasi, "stat" dan "comparison" untuk angka, "timeline" untuk kronologi.
- Isi timeline (penanda tanggal di pojok layar) pada adegan yang menandai tanggal penting.

Tipe visual:
${GRAPHIC_TYPES_GUIDE}${graphicOnly ? "" : `\n${ARCHIVAL_TYPES_GUIDE}`}

- keywords boleh kosong untuk tipe grafis. onScreenText singkat (maksimal 8 kata) atau string kosong.

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
  const graphicOnly = input.project.style === "GRAPHIC";
  return `Tulis ulang SATU adegan naskah video "${input.project.topic}" dalam ${languageName(input.project.language)}.
Instruksi dari penulis: ${input.instruction || "perbaiki agar lebih kuat dan mengalir"}

Narasi adegan sebelumnya: ${input.previous ?? "(tidak ada, ini adegan pertama)"}
Adegan saat ini (JSON): ${JSON.stringify(input.scene)}
Narasi adegan berikutnya: ${input.next ?? "(tidak ada, ini adegan terakhir)"}

Pertahankan panjang yang mirip dan alur dengan adegan sebelum dan sesudahnya. Boleh mengganti visualType bila
lebih cocok, dan isi data grafisnya sesuai tipe.
${graphicOnly ? "Video ini FULL GRAFIS: jangan pakai painting, archival_photo, atau footage." : ""}

Tipe visual:
${GRAPHIC_TYPES_GUIDE}${graphicOnly ? "" : `\n${ARCHIVAL_TYPES_GUIDE}`}

Gunakan HANYA fakta dari research brief:
${input.briefMarkdown}`;
}

export function rankAssetsPrompt(p: ProjectBrief, scenes: RankingScene[]) {
  const list = scenes
    .map((scene, i) => {
      const candidates = scene.candidates
        .map((c, j) => `  [${j}] ${c.title} (${c.provider}, ${c.kind === "VIDEO" ? "video" : "gambar"})`)
        .join("\n");
      return `Adegan ${i}: (${scene.visualType}) ${scene.narration}\n${candidates || "  (tidak ada kandidat)"}`;
    })
    .join("\n\n");
  return `Pilih aset visual untuk video sejarah militer dan geopolitik "${p.topic}".
Untuk tiap adegan, sebutkan nomor kandidat yang cocok dengan narasi dan era/tempatnya, paling cocok dulu.
Buang kandidat yang jelas tidak relevan: tulisan atau grafis modern, benda atau orang masa kini, tempat atau era
yang salah (misalnya kuil Jepang untuk Majapahit). Untuk adegan suasana (footage), pemandangan alam atau laut yang
sesuai boleh dipakai. Bila tidak ada yang cocok, kosongkan daftarnya. Sertakan semua adegan.

${list}`;
}
