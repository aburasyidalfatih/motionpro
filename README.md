# MotionPro

Studio produksi video motion graphic sejarah berbasis AI: riset topik dengan Gemini, naskah per adegan, aset (lukisan, arsip, peta), voice over, render 1080p dengan Remotion, lalu galeri dan unggah ke YouTube.

Acuan gaya template pertama: Kings and Generals dan Epic History TV (peta animasi, lukisan dengan efek ken-burns, narasi sinematik).

Rencana lengkap ada di [PRD MotionPro](https://claude.ai/code/artifact/2c3fda1a-4c00-4303-aed1-56ba4f153c18).

## Status

- **Fase 0 (Fondasi):** Next.js, Prisma + PostgreSQL, antrian BullMQ + Redis, worker, Remotion. Halaman **Sistem** menampilkan status layanan dan menjalankan job uji.
- **Fase 1 (Riset dan naskah):** proyek baru → riset otomatis dengan Gemini + Google Search → research brief bersumber yang bisa diedit → naskah per adegan (narasi, teks layar, kata kunci aset, tipe visual, data peta dan timeline) → editor adegan (edit, urutkan, tambah, hapus, tulis ulang satu adegan dengan Gemini).

Berikutnya: Fase 2 (aset dan audio).

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

Tanpa API key, isi `AI_PROVIDER=fake` di `.env` untuk menguji alur aplikasi dengan data contoh.

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev:all` | Web (Next.js) dan worker sekaligus |
| `npm run dev` | Web saja, http://localhost:3000 |
| `npm run worker` | Worker saja (restart otomatis saat kode berubah) |
| `npm run studio` | Remotion Studio untuk mendesain dan mempratinjau template video |
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
  worker/              Worker BullMQ dan handler per jenis job (riset, naskah)
  scripts/             Skrip command line (check:ai)
  remotion/            Komposisi video Remotion
  generated/prisma/    Klien Prisma hasil generate (tidak di-commit)
docker-compose.yml     PostgreSQL, Redis, MinIO
```

Setiap job pipeline dicatat di tabel `JobRun` (status, progress, error). Web hanya membuat job; worker yang mengerjakannya dan menulis progress, sehingga render berat tidak memperlambat web.

## Lisensi Remotion

Remotion gratis untuk individu dan perusahaan sampai 3 orang. Di atas itu perlu [lisensi perusahaan](https://remotion.dev/license).
