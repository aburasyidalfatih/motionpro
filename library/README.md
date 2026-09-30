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

Setelah voice over dibuat, MotionPro memilih trek pertama dari suasana yang paling sering muncul di naskah. Anda bisa menggantinya di tab **Audio**. Trek itu dipakai untuk pembuka; bila **Ganti musik tiap bab** aktif, tiap bab memakai trek dari suasana yang paling sering muncul di bab itu, dengan crossfade. Makin banyak suasana yang terisi, makin bervariasi musiknya.

Sumber yang disarankan: [YouTube Audio Library](https://studio.youtube.com) (menu **Audio Library** di YouTube Studio), karena paling aman dari klaim Content ID.

## Efek suara: `sfx/`

Awali nama file dengan jenisnya, misalnya `whoosh-1.mp3` (transisi geser, zoom, dan sapuan), `pop-1.mp3` (angka, peristiwa timeline, dan batang grafik muncul), `impact-1.mp3` (kartu judul dan kartu bab), `paper-1.mp3` (peta dibuka). Efek suara dipasang otomatis saat render. Isi beberapa file per jenis (`whoosh-1`, `whoosh-2`, ...): file dipakai bergantian agar tidak terdengar berulang.

Sumber yang disarankan: Pixabay Sound Effects, atau [Freesound](https://freesound.org) dengan lisensi CC0 atau CC BY saja. Jangan pakai CC BY-NC untuk channel yang dimonetisasi.

Riser (`riser-1.mp3`, sekitar 2 detik, suara yang makin naik) diputar menjelang kartu bab dan berakhir tepat saat kartu muncul.

## Suara latar suasana: `ambience/`

Suara latar pelan di bawah narasi, dipilih dari suasana adegan dan bersilang-fade antarbagian:

| Awalan file | Dipakai untuk suasana |
| --- | --- |
| `battle-` | Epik, tegang (pertempuran di kejauhan, derap pasukan) |
| `wind-` | Tenang, penuh harapan |
| `rain-` | Muram |
| `night-` | Misterius |

Contoh: `ambience/battle-1.mp3`, `ambience/wind-1.mp3`. File diulang (loop), jadi pilih rekaman yang bisa bersambung mulus. Sumber: Pixabay Sound Effects atau Freesound (CC0).

File audio di folder ini tidak ikut di-commit ke Git (lihat `.gitignore`).
