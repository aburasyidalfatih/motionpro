// Utilitas audio PCM 16-bit mono dari Gemini TTS.

export type WordTiming = { word: string; startMs: number; endMs: number };

export function pcmToWav(pcm: Buffer, sampleRate: number) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // ukuran chunk fmt
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte per detik
  header.writeUInt16LE(2, 32); // byte per sampel
  header.writeUInt16LE(16, 34); // bit per sampel
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function pcmDurationMs(pcm: Buffer, sampleRate: number) {
  return Math.round((pcm.length / 2 / sampleRate) * 1000);
}

// Awal dan akhir bagian bersuara (di luar hening di depan/belakang), dalam ms.
export function speechBounds(pcm: Buffer, sampleRate: number, threshold = 600) {
  const samples = pcm.length / 2;
  const window = Math.max(1, Math.round(sampleRate / 100)); // 10 ms
  const loud = (i: number) => {
    let peak = 0;
    for (let j = i; j < Math.min(i + window, samples); j++) peak = Math.max(peak, Math.abs(pcm.readInt16LE(j * 2)));
    return peak >= threshold;
  };
  let start = 0;
  while (start < samples && !loud(start)) start += window;
  let end = samples - window;
  while (end > start && !loud(end)) end -= window;
  const toMs = (s: number) => Math.round((s / sampleRate) * 1000);
  return start >= samples
    ? { startMs: 0, endMs: pcmDurationMs(pcm, sampleRate) }
    : { startMs: toMs(start), endMs: toMs(end + window) };
}

// Gemini TTS kadang menambahkan letupan pendek atau ledakan suara (clipping)
// di awal atau akhir audio, terpisah dari ucapan oleh hening. Bagian itu
// dibuang, hening di tepi dipangkas, dan tepinya diberi fade singkat.
export function trimEdgeNoise(pcm: Buffer, sampleRate: number, threshold = 600) {
  const samples = pcm.length / 2;
  const window = Math.max(1, Math.round(sampleRate / 100)); // 10 ms
  const windowMs = (n: number) => (n * window * 1000) / sampleRate;

  // Rentang bersuara (dalam jendela 10 ms), jeda di bawah 150 ms digabung.
  type Run = { start: number; end: number; clipped: boolean };
  const runs: Run[] = [];
  for (let w = 0; w * window < samples; w++) {
    let peak = 0;
    for (let j = w * window; j < Math.min((w + 1) * window, samples); j++) {
      peak = Math.max(peak, Math.abs(pcm.readInt16LE(j * 2)));
    }
    if (peak < threshold) continue;
    const last = runs.at(-1);
    if (last && windowMs(w - last.end) < 150) {
      last.end = w + 1;
      last.clipped ||= peak >= 32_000;
    } else {
      runs.push({ start: w, end: w + 1, clipped: peak >= 32_000 });
    }
  }
  const noise = (run: Run) =>
    windowMs(run.end - run.start) < 250 || (run.clipped && windowMs(run.end - run.start) < 600);
  while (runs.length > 1 && noise(runs[0])) runs.shift();
  while (runs.length > 1 && noise(runs.at(-1)!)) runs.pop();
  if (runs.length === 0) return pcm;

  const from = Math.max(0, runs[0].start * window - Math.round(sampleRate * 0.1));
  const to = Math.min(samples, runs.at(-1)!.end * window + Math.round(sampleRate * 0.15));
  const out = Buffer.from(pcm.subarray(from * 2, to * 2));
  const fade = Math.min(Math.round(sampleRate * 0.015), Math.floor((to - from) / 2));
  for (let i = 0; i < fade; i++) {
    const gain = i / fade;
    out.writeInt16LE(Math.round(out.readInt16LE(i * 2) * gain), i * 2);
    const j = to - from - 1 - i;
    out.writeInt16LE(Math.round(out.readInt16LE(j * 2) * gain), j * 2);
  }
  return out;
}

// F-20: Gemini TTS tidak memberi waktu per kata, jadi waktunya diperkirakan:
// rentang bersuara dibagi ke tiap kata menurut panjangnya, dengan jeda
// tambahan setelah tanda baca. Cukup untuk subtitle per kata.
export function estimateWordTimings(text: string, startMs: number, endMs: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const weights = words.map((w, i) => {
    const last = i === words.length - 1;
    const pause = last ? 0 : /[.!?;:]$/.test(w) ? 6 : /,$/.test(w) ? 3 : 0;
    return { speak: Math.max(2, w.replace(/[^\p{L}\p{N}]/gu, "").length), pause };
  });
  const total = weights.reduce((sum, w) => sum + w.speak + w.pause, 0);
  const msPerUnit = Math.max(0, endMs - startMs) / total;

  let cursor = startMs;
  return words.map((word, i) => {
    const start = cursor;
    const end = start + weights[i].speak * msPerUnit;
    cursor = end + weights[i].pause * msPerUnit;
    return { word, startMs: Math.round(start), endMs: Math.round(end) };
  });
}

// Nada lembut sebagai pengganti suara pada mode tiruan.
export function tonePcm(durationMs: number, sampleRate = 24_000) {
  const samples = Math.round((durationMs / 1000) * sampleRate);
  const pcm = Buffer.alloc(samples * 2);
  for (let i = 0; i < samples; i++) {
    pcm.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 3000), i * 2);
  }
  return pcm;
}
