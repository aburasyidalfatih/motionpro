// Daftar suara bawaan Gemini TTS dan preset gaya bicara. Modul ini tanpa
// dependensi server agar bisa dipakai komponen klien di halaman Audio.

export type VoiceGender = "pria" | "wanita";

export type Voice = {
  name: string;
  gender: VoiceGender;
  // Karakter suara menurut dokumentasi Gemini TTS.
  note: string;
  // Cocok untuk narasi dokumenter sejarah.
  recommended?: boolean;
};

export const VOICES: Voice[] = [
  { name: "Charon", gender: "pria", note: "informatif", recommended: true },
  { name: "Orus", gender: "pria", note: "tegas", recommended: true },
  { name: "Alnilam", gender: "pria", note: "tegas", recommended: true },
  { name: "Sadaltager", gender: "pria", note: "berpengetahuan", recommended: true },
  { name: "Rasalgethi", gender: "pria", note: "informatif", recommended: true },
  { name: "Iapetus", gender: "pria", note: "jernih", recommended: true },
  { name: "Schedar", gender: "pria", note: "stabil", recommended: true },
  { name: "Algenib", gender: "pria", note: "serak", recommended: true },
  { name: "Algieba", gender: "pria", note: "halus" },
  { name: "Enceladus", gender: "pria", note: "berdesah" },
  { name: "Umbriel", gender: "pria", note: "santai" },
  { name: "Zubenelgenubi", gender: "pria", note: "kasual" },
  { name: "Achird", gender: "pria", note: "ramah" },
  { name: "Puck", gender: "pria", note: "ceria" },
  { name: "Fenrir", gender: "pria", note: "bersemangat" },
  { name: "Sadachbia", gender: "pria", note: "hidup" },
  { name: "Gacrux", gender: "wanita", note: "matang", recommended: true },
  { name: "Kore", gender: "wanita", note: "tegas", recommended: true },
  { name: "Erinome", gender: "wanita", note: "jernih", recommended: true },
  { name: "Sulafat", gender: "wanita", note: "hangat" },
  { name: "Despina", gender: "wanita", note: "halus" },
  { name: "Pulcherrima", gender: "wanita", note: "lugas" },
  { name: "Vindemiatrix", gender: "wanita", note: "lembut" },
  { name: "Achernar", gender: "wanita", note: "pelan" },
  { name: "Aoede", gender: "wanita", note: "ringan" },
  { name: "Callirrhoe", gender: "wanita", note: "santai" },
  { name: "Zephyr", gender: "wanita", note: "cerah" },
  { name: "Autonoe", gender: "wanita", note: "cerah" },
  { name: "Leda", gender: "wanita", note: "muda" },
  { name: "Laomedeia", gender: "wanita", note: "ceria" },
];

export const DEFAULT_VOICE = "Charon";

// Instruksi gaya siap pakai; teksnya masuk ke kolom gaya bicara dan tetap bisa
// diubah. Kalimat pendek karena instruksi panjang lebih sering ikut terbaca.
export const VOICE_STYLE_PRESETS = [
  { label: "Apa adanya", style: "" },
  { label: "Dokumenter tenang", style: "Narator dokumenter: tenang dan berwibawa, tempo sedang." },
  { label: "Dramatis", style: "Dramatis dan epik, penekanan kuat, tempo agak lambat." },
  { label: "Tegang", style: "Tegang dan mendesak, suara rendah, tempo agak cepat." },
  { label: "Muram", style: "Muram dan khidmat, lembut, tempo lambat." },
  { label: "Pembaca berita", style: "Seperti pembaca berita: jelas, netral, tempo stabil." },
];

// Kalimat contoh untuk mendengarkan suara sebelum dipilih.
export const VOICE_SAMPLE_TEXT =
  "Pada 10 November 1945, Surabaya menolak menyerah. Pertempuran itu mengubah jalannya revolusi Indonesia.";
