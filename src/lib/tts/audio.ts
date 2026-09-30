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

// Olah suara narator seperti di studio siaran: high-pass 80 Hz membuang dengung
// rendah, lalu kompresor halus meratakan suku kata yang terlalu keras atau
// pelan. Kekerasan akhirnya diatur normalizeLoudness sesudahnya.
export function processVoice(pcm: Buffer, sampleRate: number) {
  const samples = pcm.length / 2;
  const out = Buffer.alloc(pcm.length);

  // Biquad high-pass (Butterworth, Q 0,707) pada 80 Hz.
  const w = (2 * Math.PI * 80) / sampleRate;
  const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
  const cos = Math.cos(w);
  const a0 = 1 + alpha;
  const [b0, b1, b2] = [(1 + cos) / 2 / a0, -(1 + cos) / a0, (1 + cos) / 2 / a0];
  const [a1, a2] = [(-2 * cos) / a0, (1 - alpha) / a0];
  let [x1, x2, y1, y2] = [0, 0, 0, 0];

  // Kompresor: ambang -20 dBFS, rasio 3:1, attack 5 ms, release 80 ms.
  const threshold = 32768 * 10 ** (-20 / 20);
  const ratio = 3;
  const attack = Math.exp(-1 / (sampleRate * 0.005));
  const release = Math.exp(-1 / (sampleRate * 0.08));
  let envelope = 0;

  for (let i = 0; i < samples; i++) {
    const x = pcm.readInt16LE(i * 2);
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    [x2, x1, y2, y1] = [x1, x, y1, y];
    const level = Math.abs(y);
    envelope = level > envelope ? attack * envelope + (1 - attack) * level : release * envelope + (1 - release) * level;
    const gain = envelope > threshold ? (threshold * (envelope / threshold) ** (1 / ratio)) / envelope : 1;
    out.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(y * gain))), i * 2);
  }
  return out;
}

// Target kekerasan bagian bersuara (RMS ±-20 dBFS) dan batas puncak (±-1 dBFS).
const TARGET_RMS = 3300;
const PEAK_LIMIT = 29_000;

// Gemini TTS menghasilkan tiap adegan dengan volume yang berbeda-beda; tanpa
// penyamaan, narasi terdengar naik-turun antaradegan. RMS dihitung hanya dari
// bagian bersuara (jendela 10 ms di atas ambang) agar jeda tidak ikut dihitung.
export function normalizeLoudness(pcm: Buffer, sampleRate: number, threshold = 600) {
  const samples = pcm.length / 2;
  const window = Math.max(1, Math.round(sampleRate / 100));
  let sumSquares = 0;
  let voiced = 0;
  let peak = 0;
  for (let w = 0; w * window < samples; w++) {
    let windowPeak = 0;
    let windowSquares = 0;
    const end = Math.min((w + 1) * window, samples);
    for (let j = w * window; j < end; j++) {
      const value = pcm.readInt16LE(j * 2);
      windowPeak = Math.max(windowPeak, Math.abs(value));
      windowSquares += value * value;
    }
    peak = Math.max(peak, windowPeak);
    if (windowPeak < threshold) continue;
    sumSquares += windowSquares;
    voiced += end - w * window;
  }
  if (voiced === 0 || peak === 0) return pcm;

  const rms = Math.sqrt(sumSquares / voiced);
  // Dibatasi agar audio yang nyaris hening atau rusak tidak diperkeras berlebihan.
  const gain = Math.max(0.25, Math.min(4, TARGET_RMS / rms, PEAK_LIMIT / peak));
  if (Math.abs(gain - 1) < 0.02) return pcm;
  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < samples; i++) {
    const value = Math.round(pcm.readInt16LE(i * 2) * gain);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, value)), i * 2);
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

// Rentang bersuara (ms), jeda lebih pendek dari minPauseMs digabung.
export function voicedRuns(pcm: Buffer, sampleRate: number, minPauseMs = 140, threshold = 600) {
  const samples = pcm.length / 2;
  const window = Math.max(1, Math.round(sampleRate / 100)); // 10 ms
  const toMs = (sample: number) => (sample / sampleRate) * 1000;
  const runs: { startMs: number; endMs: number }[] = [];
  for (let start = 0; start < samples; start += window) {
    let peak = 0;
    for (let j = start; j < Math.min(start + window, samples); j++)
      peak = Math.max(peak, Math.abs(pcm.readInt16LE(j * 2)));
    if (peak < threshold) continue;
    const last = runs.at(-1);
    const startMs = toMs(start);
    const endMs = toMs(Math.min(start + window, samples));
    if (last && startMs - last.endMs < minPauseMs) last.endMs = endMs;
    else runs.push({ startMs, endMs });
  }
  return runs;
}

// Kata yang diakhiri tanda baca: narator biasanya berhenti sejenak di sini.
const PHRASE_END = /[.,!?;:…—–)"”]$/;

// Waktu per kata yang mengikuti jeda nyata di audio: jeda di audio dicocokkan
// dengan tanda baca di teks (yang terdekat dari perkiraan), lalu kata di tiap
// frasa dibagi menurut panjangnya di antara jeda itu. Jauh lebih tepat daripada
// membagi seluruh ucapan secara rata, karena jeda antarkalimat bisa 0,3–1 detik.
export function pausedWordTimings(text: string, pcm: Buffer, sampleRate: number): WordTiming[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const bounds = speechBounds(pcm, sampleRate);
  const estimate = estimateWordTimings(text, bounds.startMs, bounds.endMs);
  if (words.length < 2) return estimate;

  const runs = voicedRuns(pcm, sampleRate).filter((r) => r.endMs > bounds.startMs && r.startMs < bounds.endMs);
  const gaps = runs.slice(1).map((run, i) => ({ startMs: runs[i].endMs, endMs: run.startMs }));
  const tolerance = Math.max(500, (bounds.endMs - bounds.startMs) * 0.2);

  // Jeda untuk tiap akhir frasa, berurutan dan tidak dipakai dua kali.
  const anchors: { word: number; gap: { startMs: number; endMs: number } }[] = [];
  let nextGap = 0;
  for (let i = 0; i < words.length - 1; i++) {
    if (!PHRASE_END.test(words[i])) continue;
    const expected = (estimate[i].endMs + estimate[i + 1].startMs) / 2;
    let best = -1;
    for (let g = nextGap; g < gaps.length; g++) {
      const mid = (gaps[g].startMs + gaps[g].endMs) / 2;
      const distance = Math.abs(mid - expected);
      if (
        distance <= tolerance &&
        (best === -1 || distance < Math.abs((gaps[best].startMs + gaps[best].endMs) / 2 - expected))
      ) {
        best = g;
      }
    }
    if (best === -1) continue;
    anchors.push({ word: i, gap: gaps[best] });
    nextGap = best + 1;
  }

  // Kata di antara dua jeda dibagi menurut panjangnya.
  const result: WordTiming[] = [];
  let from = 0;
  let startMs = bounds.startMs;
  for (const anchor of [...anchors, { word: words.length - 1, gap: { startMs: bounds.endMs, endMs: bounds.endMs } }]) {
    const phrase = words.slice(from, anchor.word + 1).join(" ");
    result.push(...estimateWordTimings(phrase, startMs, Math.max(startMs + 1, anchor.gap.startMs)));
    from = anchor.word + 1;
    startMs = anchor.gap.endMs;
  }
  return result;
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
