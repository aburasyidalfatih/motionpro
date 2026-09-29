import type { NumberedSource, ProjectBrief, RankingScene, ResearchNote } from "./types";
import type { Outline, SceneDraft } from "./schemas";

// Kecepatan bicara narator Bahasa Indonesia yang dipakai untuk perkiraan durasi.
export const WORDS_PER_MINUTE = 130;
// Rata-rata lama satu adegan. Potongan pendek membuat visual terus berganti.
export const SECONDS_PER_SCENE = 7.5;

// Jumlah pertanyaan riset dan fakta brief mengikuti durasi video.
export const researchQuestionCount = (minutes: number) => Math.min(12, 5 + Math.round(minutes / 3));
export const briefFactCount = (minutes: number) => Math.min(80, Math.max(12, Math.round(10 + minutes * 4)));

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

Susun ${researchQuestionCount(p.targetMinutes)} pertanyaan riset yang bersama-sama cukup untuk menulis naskah yang akurat
dan memikat: latar belakang, pihak-pihak yang terlibat dan kepentingannya, tokoh kunci dan keputusan mereka,
kronologi, lokasi dan geografi (termasuk pergerakan pasukan atau jalur penting), kekuatan masing-masing pihak dalam
angka, strategi dan taktik, titik balik, dampak, kutipan asli tokoh atau dokumen, anekdot, serta fakta yang jarang
diketahui. Untuk topik geopolitik terkini, sertakan pertanyaan tentang data dan perkembangan terbaru.
Tulis pertanyaan dalam ${languageName(p.language)}.`;
}

export function researchPrompt(p: ProjectBrief, question: string) {
  return `Riset untuk video sejarah militer dan geopolitik tentang "${p.topic}".
Pertanyaan: ${question}

Jawab secara faktual dan rinci dalam ${languageName(p.language)}: sertakan tanggal, angka (jumlah pasukan,
korban, anggaran, luas wilayah, dan sejenisnya), nama tempat beserta lokasinya, dan nama tokoh.
Sertakan kutipan asli (kata demi kata) bila ada, beserta siapa yang mengucapkannya dan kapan.
Sebutkan tahun data untuk angka terkini, dan sebutkan bila sumber-sumber berbeda pendapat.`;
}

// Putaran riset kedua: membaca catatan putaran pertama lalu mencari celahnya.
export function followUpPrompt(p: ProjectBrief, notes: ResearchNote[]) {
  const noteText = notes.map((n, i) => `### Catatan ${i + 1}: ${n.question}\n${n.text}`).join("\n\n");
  return `Berikut catatan riset putaran pertama untuk video "${p.topic}" (${p.targetMinutes} menit).
Periksa catatan ini sebagai editor riset dan susun 0–6 pertanyaan lanjutan untuk dicari di web, hanya untuk:
- angka atau tanggal yang bertentangan antarcatatan, atau yang belum punya sumber jelas;
- celah penting untuk cerita: lokasi yang belum jelas, jumlah pasukan atau korban yang kosong, keputusan tokoh yang
  belum dijelaskan, akhir peristiwa yang belum diceritakan;
- bahan yang membuat video memikat tetapi belum ada: kutipan asli, anekdot, detail yang jarang diketahui.
Jangan mengulang pertanyaan yang sudah terjawab. Kosongkan daftar bila catatan sudah lengkap.
Tulis pertanyaan dalam ${languageName(p.language)}.

${noteText}`;
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
- Tulis sekitar ${briefFactCount(p.targetMinutes)} fakta yang padat dan spesifik: nama tokoh dan satuan, tempat, tanggal,
  angka, keputusan penting, titik balik, anekdot, dan detail yang jarang diketahui. Satu fakta satu kalimat.
- Bila catatan berbeda soal angka atau tanggal, tulis rentangnya dan sebutkan bahwa sumber berbeda
  (misalnya "antara 6.000 dan 20.000 korban, sumber berbeda").
- Kumpulkan kutipan asli (kata demi kata) yang ada di catatan ke daftar quotes; jangan mengarang atau
  memparafrasekan kutipan.

Daftar sumber:
${sourceList || "(tidak ada)"}

Catatan riset:
${noteText}`;
}

const GRAPHIC_TYPES_GUIDE = `- "title": kartu judul video (adegan terakhir pembuka) atau pembuka bab. onScreenText = judul video atau judul
  bab. Narasinya satu kalimat pendek.
- "kinetic_text": kalimat kunci ditampilkan besar. Isi kinetic.lines (1–3 baris pendek, maksimal 6 kata per baris,
  diambil PERSIS dari narasi agar muncul saat diucapkan) dan kinetic.emphasis (1–3 kata terpenting dari lines).
- "map": adegan tentang lokasi, wilayah, pergerakan pasukan, jalur, atau posisi negara. Isi map dengan koordinat
  lat/lng yang benar, dan points[].place dengan nama tempat masa kini lengkap dengan wilayah dan negara (koordinat
  dicek ulang dengan nama itu di OpenStreetMap). Label titik sama dengan nama yang diucapkan narasi. Untuk konflik
  isi map.sides (nama pihak), points[].side, map.arrows (gerak pasukan/armada dari indeks titik ke indeks titik) dan
  map.zones (wilayah kekuasaan, radiusKm) bila relevan.
- "timeline": kronologi beberapa peristiwa. Isi events (2–7 peristiwa: date singkat seperti "1825" atau "10 Nov",
  label maksimal 5 kata). onScreenText = judul timeline. Hanya satu tanggal? Jangan pakai "timeline": pakai
  "kinetic_text" dan isi timeline (penanda tanggal di pojok layar).
- "stat": angka penting. Isi stats (1–3 angka dengan label singkat; prefix/suffix bila perlu, misalnya "%", " km",
  "US$"). onScreenText = judul singkat.
- "chart": nilai yang berubah dari waktu ke waktu atau dibandingkan antarbanyak pihak (anggaran, jumlah pasukan per
  tahun, korban per pihak). Isi chart.bars (2–8 batang: label tahun atau pihak, value angka) dan prefix/suffix.
  onScreenText = judul grafik.
- "comparison": perbandingan dua pihak (kekuatan militer, ekonomi, strategi). Isi comparison.left/right dan
  rows (2–5 aspek); isi leftValue/rightValue bila angkanya bisa dibandingkan.
- "profile": memperkenalkan tokoh penting saat pertama kali muncul. Isi profile.name, role, years (bila ada di
  brief), dan facts (1–3 fakta singkat dari brief).
- "quote": kutipan asli tokoh atau dokumen yang ada di brief (bagian Kutipan asli). Isi quote.text dan
  quote.source. Jangan mengarang kutipan.`;

const ARCHIVAL_TYPES_GUIDE = `- "painting": lukisan sejarah; "archival_photo": foto arsip (hanya setelah sekitar 1840);
  "footage": suasana (laut, hutan, kota, reruntuhan). Untuk ketiganya isi keywords dalam bahasa Inggris yang
  spesifik untuk mencari aset (contoh: "Diponegoro painting", "Dutch colonial army 1830").`;

// Teknik bercerita yang membuat penonton bertahan sampai akhir.
const RETENTION_RULES = `Teknik retensi (wajib):
- Pembuka (cold open): mulai langsung dari momen paling dramatis atau mengejutkan, tanpa salam atau perkenalan
  channel. Tanamkan satu pertanyaan besar yang baru terjawab di akhir video.
- Setiap bab diakhiri open loop: ancaman, keputusan, atau pertanyaan yang belum terjawab, sehingga penonton ingin
  lanjut ke bab berikutnya.
- Setiap sekitar 60–90 detik beri re-hook: fakta mengejutkan, angka tak terduga, twist, atau perbandingan tajam.
- Ketegangan naik menuju klimaks sekitar 70–80% video; penutup menjawab pertanyaan pembuka (callback).
- Konkret: nama orang dan satuan, tempat, angka, tanggal, dan detail dari brief. Hindari kalimat umum dan pengisi
  seperti "mari kita lihat", "tidak diragukan lagi", "sepanjang sejarah", "menarik untuk dicatat".
- Sudut pandang manusia: keputusan tokoh, taruhannya, dan akibatnya.
- Variasikan panjang kalimat; kalimat pendek untuk momen tegang.`;

function visualRules(graphicOnly: boolean) {
  return `Aturan visual:
- Satu adegan = 1–2 kalimat (sekitar 5–9 detik). Informasi baru berarti adegan baru dengan visual baru.
- ${graphicOnly ? "Video ini FULL GRAFIS: hanya pakai visualType grafis, jangan pakai painting, archival_photo, atau footage." : "Campur adegan grafis dengan lukisan, foto arsip, dan footage; pakai grafis untuk peta, angka, kronologi, dan perbandingan."}
- Jangan pakai visualType yang sama lebih dari 2 adegan berturut-turut; "kinetic_text" paling banyak sekitar 25%
  adegan. Utamakan "map" untuk pergerakan dan lokasi, "stat"/"chart"/"comparison" untuk angka, "timeline" untuk
  kronologi, "profile" saat tokoh penting pertama kali muncul, "quote" untuk kutipan asli.
- Isi "cue" pada setiap titik peta, panah, peristiwa, angka, batang grafik, dan baris perbandingan dengan kata atau
  frasa PERSIS dari narasi adegan itu saat elemen tersebut harus muncul di layar.
- Tulis angka di narasi dengan angka (misalnya 40.000, bukan empat puluh ribu), sama dengan value di stats atau
  chart, agar angka muncul tepat saat diucapkan.
- Isi timeline (penanda tanggal di pojok layar) pada adegan yang menandai tanggal penting.
- keywords boleh kosong untuk tipe grafis. onScreenText singkat (maksimal 8 kata) atau string kosong.

Tipe visual:
${GRAPHIC_TYPES_GUIDE}${graphicOnly ? "" : `\n${ARCHIVAL_TYPES_GUIDE}`}`;
}

// Tahap 1 naskah: kerangka bab dari brief.
export function outlinePrompt(p: ProjectBrief, briefMarkdown: string) {
  const chapters = Math.min(8, Math.max(2, Math.round(p.targetMinutes / 2)));
  return `Susun kerangka naskah video "${p.topic}" (${p.targetMinutes} menit) dalam ${languageName(p.language)}, gaya ${p.tone}.

- Pembuka sekitar 20–30 detik, lalu sekitar ${chapters} bab, masing-masing dengan judul, isi, fakta yang dibahas, re-hook
  di tengah bab, dan open loop di akhir bab. Jumlah menit semua bab sekitar ${p.targetMinutes} menit.
- Urutan bab membentuk cerita dengan ketegangan yang naik, bukan daftar topik. Klimaks di bab menjelang akhir.
- Setiap fakta penting di brief masuk ke salah satu bab; jangan menambah fakta di luar brief.

${RETENTION_RULES}

Research brief:
${briefMarkdown}`;
}

export type ScriptPart = { kind: "opening" } | { kind: "chapter"; index: number };

function partTask(outline: Outline, part: ScriptPart, sceneCount: number) {
  if (part.kind === "opening") {
    return `Tulis PEMBUKA video: sekitar ${sceneCount} adegan (20–30 detik). Rencana: ${outline.hook}
Adegan terakhir pembuka bertipe "title" dengan onScreenText = "${outline.title}".`;
  }
  const chapter = outline.chapters[part.index];
  const last = part.index === outline.chapters.length - 1;
  return `Tulis BAB ${part.index + 1} dari ${outline.chapters.length}: "${chapter.title}", sekitar ${sceneCount} adegan.
Adegan pertama bertipe "title" dengan onScreenText = "${chapter.title}" (kartu bab).
Isi bab: ${chapter.summary}
Fakta yang dibahas:
${chapter.points.map((point) => `- ${point}`).join("\n")}
Re-hook di tengah bab: ${chapter.reHook}
${last ? `Ini bab terakhir: tutup video sesuai rencana penutup: ${outline.ending}` : `Akhiri bab dengan open loop: ${chapter.openLoop}`}
Suasana (mood) utama bab: ${chapter.mood}.`;
}

function outlineSummary(outline: Outline) {
  return [
    `Judul: ${outline.title}`,
    `Pembuka: ${outline.hook}`,
    ...outline.chapters.map((c, i) => `Bab ${i + 1}: ${c.title} — ${c.summary}`),
    `Penutup: ${outline.ending}`,
  ].join("\n");
}

// Tahap 2 naskah: menulis satu bagian (pembuka atau satu bab) sesuai kerangka.
export function chapterPrompt(input: {
  project: ProjectBrief;
  briefMarkdown: string;
  outline: Outline;
  part: ScriptPart;
  sceneCount: number;
  previous: string[];
}) {
  const { project: p, outline, part } = input;
  return `Kamu menulis naskah video "${p.topic}" (${p.targetMinutes} menit) dalam ${languageName(p.language)}, gaya ${p.tone},
satu bagian demi satu bagian.

Kerangka seluruh video:
${outlineSummary(outline)}

${partTask(outline, part, input.sceneCount)}

Narasi bagian sebelumnya (lanjutkan alurnya, jangan mengulang):
${input.previous.length ? input.previous.join(" ") : "(belum ada, ini awal video)"}

- Total narasi bagian ini sekitar ${Math.round((input.sceneCount * SECONDS_PER_SCENE * WORDS_PER_MINUTE) / 60)} kata.
- Gunakan HANYA fakta dari research brief. Jangan menambah fakta, angka, atau kutipan baru.

${RETENTION_RULES}

${visualRules(p.style === "GRAPHIC")}

Research brief:
${input.briefMarkdown}`;
}

// Tahap 3 naskah: editor memeriksa satu bagian dan mengembalikan versi yang sudah diperbaiki.
export function reviewPrompt(input: {
  project: ProjectBrief;
  briefMarkdown: string;
  outline: Outline;
  part: ScriptPart;
  scenes: SceneDraft[];
}) {
  const { project: p, outline, part } = input;
  const label = part.kind === "opening" ? "pembuka" : `bab ${part.index + 1} ("${outline.chapters[part.index].title}")`;
  return `Kamu editor naskah dan pemeriksa fakta untuk video "${p.topic}". Periksa ${label} di bawah (JSON), lalu kembalikan
seluruh adegannya dalam versi yang sudah diperbaiki beserta daftar masalah yang kamu perbaiki.

Periksa dan perbaiki:
1. Fakta: setiap nama, angka, tanggal, dan kutipan harus ada di research brief. Hapus atau ganti yang tidak ada;
   kutipan yang tidak ada di brief diganti adegan lain.
2. Retensi: buang kalimat pengisi dan pengulangan, pastikan ada re-hook dan ${part.kind === "opening" ? "pertanyaan besar yang ditanamkan" : "akhir bab yang membuat penasaran"}.
3. Visual: data grafis lengkap sesuai tipenya, variasi visualType sesuai aturan, "cue" diambil PERSIS dari narasi
   adegan yang sama, dan angka di narasi sama dengan value di stats atau chart.
4. Jaga urutan cerita, jumlah adegan (boleh berubah sedikit), adegan "title" di tempatnya, dan panjang narasi.

${RETENTION_RULES}

${visualRules(p.style === "GRAPHIC")}

Adegan (JSON):
${JSON.stringify(input.scenes)}

Research brief:
${input.briefMarkdown}`;
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

${visualRules(graphicOnly)}

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
