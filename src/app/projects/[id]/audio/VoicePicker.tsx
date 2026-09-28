"use client";

import { useEffect, useRef, useState } from "react";
import type { Voice } from "@/lib/tts/voices";

type Filter = "disarankan" | "pria" | "wanita" | "semua";

const filters: { value: Filter; label: string }[] = [
  { value: "disarankan", label: "Disarankan" },
  { value: "pria", label: "Pria" },
  { value: "wanita", label: "Wanita" },
  { value: "semua", label: "Semua" },
];

const visible = (voice: Voice, filter: Filter) =>
  filter === "semua" || (filter === "disarankan" ? voice.recommended : voice.gender === filter);

// Kartu pilihan suara narator (input radio "voiceId" di form pengaturan suara)
// dengan tombol untuk memutar contoh suaranya. Kartu yang tersaring hanya
// disembunyikan agar pilihan tetap terkirim.
export function VoicePicker({
  voices,
  defaultValue,
  samples,
}: {
  voices: Voice[];
  defaultValue: string;
  // URL contoh suara per nama suara; suara tanpa contoh tidak ada di sini.
  samples: Record<string, string>;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const [filter, setFilter] = useState<Filter>(() =>
    voices.find((v) => v.name === defaultValue)?.recommended ? "disarankan" : "semua",
  );
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => () => audio.current?.pause(), []);

  function toggle(name: string) {
    audio.current?.pause();
    if (playing === name) {
      setPlaying(null);
      return;
    }
    const player = new Audio(samples[name]);
    player.onended = () => setPlaying((current) => (current === name ? null : current));
    audio.current = player;
    setPlaying(name);
    void player.play().catch(() => setPlaying(null));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f.value
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {voices.map((voice) => {
          const checked = selected === voice.name;
          const sample = samples[voice.name];
          return (
            <label
              key={voice.name}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                visible(voice, filter) || checked ? "" : "hidden"
              } ${
                checked
                  ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
                  : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              }`}
            >
              <input
                type="radio"
                name="voiceId"
                value={voice.name}
                checked={checked}
                onChange={() => setSelected(voice.name)}
                className="accent-zinc-900 dark:accent-zinc-100"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{voice.name}</span>
                <span className="block text-xs text-zinc-500">
                  {voice.gender} · {voice.note}
                </span>
              </span>
              <button
                type="button"
                onClick={() => toggle(voice.name)}
                disabled={!sample}
                title={sample ? `Putar contoh suara ${voice.name}` : "Contoh suara belum dibuat"}
                aria-label={playing === voice.name ? "Hentikan contoh" : "Putar contoh"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-xs hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-700"
              >
                {playing === voice.name ? "■" : "▶"}
              </button>
            </label>
          );
        })}
      </div>
    </div>
  );
}
