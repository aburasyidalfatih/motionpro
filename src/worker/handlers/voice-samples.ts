import { aiConcurrency } from "@/lib/ai";
import { mapLimit } from "@/lib/async";
import type { VoiceSamplesJobInput } from "@/lib/queue";
import { saveFile } from "@/lib/storage";
import { listVoiceSamples, synthesize, VOICE_SAMPLE_TEXT, VOICES, voiceSamplePath, voiceSeed } from "@/lib/tts";
import { pcmToWav } from "@/lib/tts/audio";
import type { JobHandler } from "../types";

// Contoh suara narator untuk halaman Audio. Dibuat sekali per suara dan model,
// lalu dipakai semua proyek; suara yang sudah punya contoh dilewati.
export const voiceSamples: JobHandler = async ({ run, setProgress }) => {
  const input = (run.input ?? {}) as VoiceSamplesJobInput;
  const existing = await listVoiceSamples();
  const known = new Set(VOICES.map((v) => v.name));
  const voices = (input.voices ?? [...known]).filter((v) => known.has(v) && !existing.has(v));

  let done = 0;
  await mapLimit(voices, aiConcurrency(), async (voice) => {
    const speech = await synthesize(VOICE_SAMPLE_TEXT, { voice, style: "", seed: voiceSeed("contoh") });
    await saveFile(voiceSamplePath(voice), pcmToWav(speech.pcm, speech.sampleRate));
    done++;
    await setProgress((done / voices.length) * 100);
  });
  return { voices: voices.length };
};
