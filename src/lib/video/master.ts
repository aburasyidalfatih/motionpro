import { rename, unlink } from "node:fs/promises";
import { RenderInternals } from "@remotion/renderer";

// Mastering audio akhir ke standar YouTube: -14 LUFS terintegrasi, puncak
// sebenarnya -1,5 dBTP. Tanpa ini video terdengar lebih pelan (atau lebih
// keras) dari video lain di YouTube. Memakai filter loudnorm dua tahap dari
// ffmpeg bawaan Remotion (tanpa pemasangan ffmpeg terpisah).

const TARGET = { I: -14, TP: -1.5, LRA: 11 };

type Measurement = {
  input_i: string;
  input_tp: string;
  input_lra: string;
  input_thresh: string;
  target_offset: string;
};

async function ffmpeg(args: string[]) {
  const { stderr } = await RenderInternals.callFf({
    bin: "ffmpeg",
    args,
    indent: false,
    logLevel: "error",
    binariesDirectory: null,
    cancelSignal: undefined,
  });
  return stderr;
}

// Blok JSON terakhir di keluaran loudnorm (print_format=json).
function parseMeasurement(stderr: string): Measurement {
  const start = stderr.lastIndexOf("{");
  const end = stderr.lastIndexOf("}");
  if (start === -1 || end < start) throw new Error("Hasil pengukuran loudness tidak ditemukan");
  return JSON.parse(stderr.slice(start, end + 1)) as Measurement;
}

const target = `I=${TARGET.I}:TP=${TARGET.TP}:LRA=${TARGET.LRA}`;

// Mengukur lalu menormalkan audio file MP4 di tempat; video disalin tanpa encode ulang.
export async function masterLoudness(videoPath: string) {
  const measured = parseMeasurement(
    await ffmpeg([
      "-hide_banner",
      "-nostats",
      "-i",
      videoPath,
      "-vn",
      "-af",
      `loudnorm=${target}:print_format=json`,
      "-f",
      "null",
      "-",
    ]),
  );
  // Video tanpa suara (misalnya semua adegan belum bersuara) tidak diubah.
  if (!Number.isFinite(Number(measured.input_i))) return { inputLufs: null };

  const output = videoPath.replace(/\.mp4$/, ".master.mp4");
  try {
    await ffmpeg([
      "-hide_banner",
      "-y",
      "-i",
      videoPath,
      "-c:v",
      "copy",
      "-af",
      [
        `loudnorm=${target}`,
        `measured_I=${measured.input_i}`,
        `measured_TP=${measured.input_tp}`,
        `measured_LRA=${measured.input_lra}`,
        `measured_thresh=${measured.input_thresh}`,
        `offset=${measured.target_offset}`,
        "linear=true",
      ].join(":"),
      // loudnorm bekerja pada 192 kHz; dikembalikan ke 48 kHz.
      "-ar",
      "48000",
      "-c:a",
      "aac",
      "-b:a",
      "320k",
      "-movflags",
      "+faststart",
      output,
    ]);
    await rename(output, videoPath);
  } catch (err) {
    await unlink(output).catch(() => {});
    throw err;
  }
  return { inputLufs: Number(measured.input_i) };
}
