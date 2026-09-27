# MotionPro

Studio produksi video motion graphic sejarah berbasis AI: riset topik dengan Gemini, naskah per adegan, aset (lukisan, arsip, peta), voice over, render 1080p dengan Remotion, lalu galeri dan unggah ke YouTube.

Acuan gaya template pertama: Kings and Generals dan Epic History TV (peta animasi, lukisan dengan efek ken-burns, narasi sinematik).

Rencana lengkap ada di [PRD MotionPro](https://claude.ai/code/artifact/2c3fda1a-4c00-4303-aed1-56ba4f153c18).

## Status

**Fase 0 (Fondasi) selesai:** Next.js, Prisma + PostgreSQL, antrian BullMQ + Redis, worker, dan proyek Remotion dengan satu kartu judul. Halaman **Sistem** menampilkan status layanan dan bisa menjalankan job uji dari web → Redis → worker → database.

Berikutnya: Fase 1 (proyek baru, riset dengan Gemini, naskah per adegan).

## Kebutuhan

- Node.js 20.19 atau lebih baru
- Docker Desktop (untuk PostgreSQL, Redis, dan MinIO)
- Git

Windows: pasang Docker Desktop dengan backend WSL2, dan jalankan perintah di bawah dari terminal WSL (Ubuntu) supaya perilakunya sama dengan VPS Linux nanti.

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

## Perintah

| Perintah | Fungsi |
| --- | --- |
| `npm run dev:all` | Web (Next.js) dan worker sekaligus |
| `npm run dev` | Web saja, http://localhost:3000 |
| `npm run worker` | Worker saja (restart otomatis saat kode berubah) |
| `npm run studio` | Remotion Studio untuk mendesain dan mempratinjau template video |
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
  worker/              Worker BullMQ dan handler per jenis job
  remotion/            Komposisi video Remotion
  generated/prisma/    Klien Prisma hasil generate (tidak di-commit)
docker-compose.yml     PostgreSQL, Redis, MinIO
```

Setiap job pipeline dicatat di tabel `JobRun` (status, progress, error). Web hanya membuat job; worker yang mengerjakannya dan menulis progress, sehingga render berat tidak memperlambat web.

## Lisensi Remotion

Remotion gratis untuk individu dan perusahaan sampai 3 orang. Di atas itu perlu [lisensi perusahaan](https://remotion.dev/license).
