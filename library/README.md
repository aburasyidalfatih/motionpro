# Library musik dan efek suara

MotionPro tidak mengunduh musik atau efek suara secara otomatis. Isi folder ini sekali dengan file yang lisensinya aman untuk YouTube, lalu aplikasi memakainya untuk semua video.

## Musik latar: `music/<suasana>/`

Nama folder mengikuti suasana adegan di naskah:

| Folder | Suasana |
| --- | --- |
| `epic/` | Epik: pertempuran, kejayaan |
| `tense/` | Tegang: konflik, pengepungan |
| `calm/` | Tenang: latar, geografi |
| `somber/` | Muram: keruntuhan, tragedi |
| `hopeful/` | Penuh harapan: kebangkitan, penutup |
| `mysterious/` | Misterius: teka-teki sejarah |

Setelah voice over dibuat, MotionPro memilih trek pertama dari suasana yang paling sering muncul di naskah. Anda bisa menggantinya di tab **Audio**.

Sumber yang disarankan: [YouTube Audio Library](https://studio.youtube.com) (menu **Audio Library** di YouTube Studio), karena paling aman dari klaim Content ID.

## Efek suara: `sfx/`

Awali nama file dengan jenisnya, misalnya `whoosh-1.mp3` (transisi), `pop-1.mp3` (teks muncul), `impact-1.mp3` (kartu judul), `paper-1.mp3` (peta atau dokumen). Efek suara dipasang otomatis saat render (Fase 3).

Sumber yang disarankan: Pixabay Sound Effects, atau [Freesound](https://freesound.org) dengan lisensi CC0 atau CC BY saja. Jangan pakai CC BY-NC untuk channel yang dimonetisasi.

File audio di folder ini tidak ikut di-commit ke Git (lihat `.gitignore`).
