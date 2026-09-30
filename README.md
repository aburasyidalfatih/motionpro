# MotionPro

Studio produksi video motion graphic **sejarah militer dan geopolitik** berbasis AI: riset topik dengan Gemini, naskah per adegan, visual grafis (peta pertempuran, panah pasukan, timeline, statistik, perbandingan, teks kinetik, kutipan), voice over, render 1080p dengan Remotion, lalu galeri dan unggah ke YouTube.

Dua gaya video per proyek:

- **Full grafis** (default): semua adegan digambar oleh template React, tanpa gambar atau video dari pihak ketiga.
- **Arsip dan grafis**: lukisan, foto arsip (Wikimedia Commons), dan footage (Pexels), dicampur adegan grafis.

Acuan gaya: Kings and Generals, RealLifeLore, Caspian Report.

Rencana lengkap ada di [PRD MotionPro](https://claude.ai/code/artifact/2c3fda1a-4c00-4303-aed1-56ba4f153c18).

## Status

- **Fase 0 (Fondasi):** Next.js, Prisma + PostgreSQL, antrian BullMQ + Redis, worker, Remotion. Halaman **Sistem** menampilkan status layanan dan menjalankan job uji.
- **Fase 1 (Riset dan naskah):** proyek baru → riset otomatis dengan Gemini + Google Search → research brief bersumber yang bisa diedit → naskah per adegan (narasi, teks layar, kata kunci aset, tipe visual, data peta dan timeline) → editor adegan (edit, urutkan, tambah, hapus, tulis ulang satu adegan dengan Gemini).
- **Fase 2 (Aset dan audio):** storyboard dengan aset otomatis per adegan (lukisan dan arsip dari Wikimedia Commons, footage dari Pexels), ganti kandidat, cari ulang, unggah aset sendiri, lisensi tercatat; voice over per adegan dengan Gemini TTS (durasi adegan mengikuti audio, waktu per kata untuk subtitle); musik latar dari library sendiri.
- **Fase 3 (Template, render, galeri):** template video sejarah (kartu judul, lukisan dengan ken-burns, footage, peta animasi dengan rute, label, penanda tahun, subtitle karaoke, crossfade, musik dengan ducking, SFX), pratinjau di browser, render MP4 1080p 30 fps (H.264, AAC) di antrian dengan progress, gambar mini dan file SRT, galeri dengan unduhan.

- **Niche militer dan geopolitik:** gaya full grafis dengan 9 tipe adegan grafis (termasuk grafik batang, profil tokoh, dan kartu bab), peta pertempuran (pihak, panah pasukan, zona kekuasaan, garis pantai detail untuk peta tingkat kota), editor data grafis per adegan.
- **Retensi penonton:** riset dua putaran (putaran kedua mencari celah dan angka yang bertentangan, jumlah fakta mengikuti durasi, kutipan asli); naskah bertahap: kerangka bab dengan cold open, re-hook, dan open loop → ditulis per bab → diperiksa editor AI (fakta, retensi, data grafis); adegan pendek (5–9 detik). Di video, titik peta, angka, peristiwa, dan baris perbandingan muncul saat narator menyebutnya, kamera peta mengikuti aksi, transisi bervariasi, kartu bab, musik berganti per bab, dan efek suara pada transisi dan beat.

Berikutnya: Fase 4 (unggah ke YouTube dan deploy ke VPS).

## Kebutuhan

- Node.js 20.19 atau lebih baru
- Docker Desktop (untuk PostgreSQL, Redis, dan MinIO)
- Git

Windows: pasang Docker Desktop (backend WSL2). Perintah di bawah bisa dijalankan dari PowerShell atau terminal WSL.

## Menjalankan di komputer lokal

```bash
# 1. Pasang dependency (otomatis menjalankan prisma generate)
npm install

# 2. Siapkan konfigurasi
cp .env.example .env

# 3. Jalankan PostgreSQL, Redis, dan MinIO
docker compose up -d

# 4. Buat tabel database
npm run db:migrate

# 5. Jalankan web dan worker sekaligus
npm run dev:all
```

Buka http://localhost:3000/system. Ketiga indikator (Database, Antrian, Worker) harus hijau. Klik **Jalankan job uji** untuk memastikan antrian bekerja.

Windows PowerShell: pakai `Copy-Item .env.example .env` untuk langkah 2, dan selalu jalankan perintah dari folder proyek.

## API key Gemini (Fase 1)

1. Buat API key di https://aistudio.google.com (**Get API key** → **Create API key**).
2. Isi `GEMINI_API_KEY` di `.env`. Model default `gemini-3.8-flash`; ganti lewat `GEMINI_MODEL` bila perlu.
3. Restart `npm run dev:all`, lalu buka **Proyek → Proyek baru**.

Periksa kualitas riset dan naskah untuk 5 topik uji tanpa lewat UI (gate Fase 1):

```bash
npm run check:ai
npm run check:ai -- "Topik lain"
```

Tanpa API key, isi `AI_PROVIDER=fake` di `.env` untuk menguji alur aplikasi dengan data contoh (riset, naskah, aset, dan suara tiruan).

## Aset dan audio (Fase 2)

- **Aset:** Wikimedia Commons dipakai tanpa API key. Untuk footage video, isi `PEXELS_API_KEY` (gratis di https://www.pexels.com/api). Hanya lisensi domain publik, CC0, CC BY, CC BY-SA, dan Pexels License yang dipakai.
- **Voice over:** memakai `GEMINI_API_KEY` yang sama, model default `gemini-3.8-flash-tts` (ganti lewat `GEMINI_TTS_MODEL`). Suara dan gaya bicara diatur per proyek di tab **Audio**.
- **Musik dan efek suara:** isi folder `library/` sendiri; lihat [library/README.md](library/README.md).
- Semua file (aset, audio, unggahan) disimpan di `STORAGE_DIR` (default `./storage`).

## Render (Fase 3)

- **Finishing:** butiran film, grading warna, vignette, light leak di kartu judul dan bab (`@remotion/effects`), dan motion blur saat transisi (`@remotion/motion-blur`, hanya saat render). Audio akhir dinormalkan ke -14 LUFS, standar YouTube. Pilih **1440p** di tab Render agar YouTube memakai codec yang lebih tajam. Video dengan kartu bab mendapat daftar **chapter YouTube** di galeri, siap disalin ke deskripsi.
- **Peta:** globe 3D pembuka saat lokasi berpindah jauh, negara masa kini disorot dengan warna pihak, simbol satuan militer (MIL-STD-2525, `milsymbol`) yang bergerak mengikuti panah, lokasi bentrokan, dan garis depan.
- **Ilustrasi AI:** adegan `illustration` (cold open, klimaks) dibuat Gemini (`GEMINI_IMAGE_MODEL`) di tahap aset; prompt bisa diedit dan gambar dibuat ulang di Storyboard. Pada gaya arsip, kartu profil tokoh memakai potret dari Wikimedia Commons.
- **Suara:** suara latar per suasana (`library/ambience`), riser menjelang kartu bab, dan narator diolah seperti suara siaran (high-pass dan kompresor).
- **Thumbnail dan end screen:** thumbnail 1280×720 dengan teks besar dari naskah (bisa diedit di tab Render); end screen 20 detik opsional untuk elemen akhir YouTube.
- **QA:** tab Render menampilkan catatan ritme sebelum render (bagian yang diam terlalu lama, tipe visual berulang); tombol **Periksa dengan AI** di kartu video memeriksa satu frame per adegan dengan Gemini.
- **Waktu per kata:** dihitung dari jeda nyata di audio voice over, dicocokkan dengan tanda baca. Untuk ketepatan per kata, pasang Whisper sekali: isi `WHISPER_MODEL="small"` di `.env`, jalankan `npm run whisper:setup`, restart worker, lalu klik **Hitung ulang waktu kata** di tab Audio untuk voice over yang sudah ada.
- **Mengembangkan template dengan agen AI:** pasang skill resmi Remotion dengan `npx skills add remotion-dev/skills` (praktik terbaik Remotion untuk Claude Code, Cursor, dan sejenisnya).

- Tab **Render** di halaman proyek memutar pratinjau video lengkap di browser, lalu **Render video 1080p** memasukkan render ke antrian. Hasilnya (MP4, gambar mini, SRT) disimpan di `storage/videos/` dan tampil di **Galeri**.
- Render memakan hampir seluruh CPU. Video 10 menit butuh sekitar 10–40 menit tergantung komputer. Atur jumlah tab Chrome paralel lewat `RENDER_CONCURRENCY`.
- Coba template tanpa data proyek: menu **Pratinjau template**, atau `npm run studio` lalu pilih komposisi **HistoryVideo** (data contoh Pertempuran Surabaya).

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev:all` | Web (Next.js) dan worker sekaligus |
| `npm run dev` | Web saja, http://localhost:3000 |
| `npm run worker` | Worker saja (restart otomatis saat kode berubah) |
| `npm run studio` | Remotion Studio untuk mendesain dan mempratinjau template video |
| `npm run whisper:setup` | Memasang whisper.cpp dan model Whisper (`WHISPER_MODEL`) untuk waktu kata yang akurat |
| `npm run check:ai` | Menguji riset dan naskah Gemini untuk 5 topik (gate Fase 1) |
| `npm run db:migrate` | Membuat dan menjalankan migrasi database |
| `npm run db:studio` | Melihat isi database di browser |
| `npm run typecheck` | Pemeriksaan TypeScript |
| `npm run lint` | ESLint |
| `npm run build` / `npm start` | Build dan jalankan versi produksi |

Render contoh video dari command line:

```bash
npx remotion render src/remotion/index.ts TitleCard out/titlecard.mp4
```

Remotion mengunduh Chrome headless sendiri saat pertama kali render. Kalau jaringan memblokirnya, arahkan ke Chromium yang sudah terpasang dengan `--browser-executable=/path/ke/chrome`.

## Struktur

```
prisma/
  schema.prisma        Model data (Project, Scene, Asset, JobRun, Video, ...)
  migrations/          Migrasi SQL
src/
  app/                 Halaman Next.js (Proyek, Pratinjau template, Sistem) dan API
  lib/                 env, database, antrian, pemeriksaan kesehatan
  lib/ai/              Gemini: prompt, skema output (zod), implementasi tiruan
  lib/assets/          Pencarian dan unduhan aset (Wikimedia Commons, Pexels)
  lib/tts/             Voice over Gemini TTS, WAV, perkiraan waktu per kata
  worker/              Worker BullMQ dan handler per jenis job (riset, naskah, aset, audio, render)
  scripts/             Skrip command line (check:ai)
  remotion/            Komposisi video Remotion (history/ = template video sejarah)
  lib/video/           Data template dari database, SRT, server file untuk render
  generated/prisma/    Klien Prisma hasil generate (tidak di-commit)
library/               Musik latar dan efek suara milik sendiri (file audio tidak di-commit)
storage/               File aset, audio, dan unggahan (tidak di-commit)
docker-compose.yml     PostgreSQL, Redis, MinIO
```

Setiap job pipeline dicatat di tabel `JobRun` (status, progress, error). Web hanya membuat job; worker yang mengerjakannya dan menulis progress, sehingga render berat tidak memperlambat web.

## Lisensi Remotion

Remotion gratis untuk individu dan perusahaan sampai 3 orang. Di atas itu perlu [lisensi perusahaan](https://remotion.dev/license).
