import "dotenv/config";
import { downloadWhisperModel, installWhisperCpp } from "@remotion/install-whisper-cpp";
import { WHISPER_CPP_VERSION, whisperConfig } from "@/lib/tts/whisper";

// Memasang whisper.cpp dan mengunduh model Whisper untuk waktu kata yang akurat.
//   1. Isi WHISPER_MODEL di .env, misalnya "small" (±500 MB, disarankan untuk Bahasa Indonesia)
//   2. npm run whisper:setup
// Windows mengunduh versi siap pakai; Linux dan macOS mengompilasi (butuh git dan make).
async function main() {
  const config = whisperConfig();
  if (!config) {
    console.log('Isi WHISPER_MODEL di .env dulu, misalnya WHISPER_MODEL="small", lalu jalankan lagi.');
    process.exit(1);
  }
  console.log(`Memasang whisper.cpp ${WHISPER_CPP_VERSION} di ${config.dir}`);
  await installWhisperCpp({ to: config.dir, version: WHISPER_CPP_VERSION });
  console.log(`Mengunduh model ${config.model}`);
  await downloadWhisperModel({ model: config.model, folder: config.dir });
  console.log("Selesai. Restart worker; voice over berikutnya memakai waktu kata dari Whisper.");
}

void main();
