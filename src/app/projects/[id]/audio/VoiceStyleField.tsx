"use client";

import { useState } from "react";

// Kolom gaya bicara (textarea "voiceStyle") dengan tombol preset yang mengisi
// teksnya; teks hasil preset tetap bisa diubah.
export function VoiceStyleField({
  id,
  defaultValue,
  presets,
  placeholder,
  className,
}: {
  id: string;
  defaultValue: string;
  presets: { label: string; style: string }[];
  placeholder: string;
  className: string;
}) {
  const [style, setStyle] = useState(defaultValue);
  return (
    <>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {presets.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => setStyle(preset.style)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              style.trim() === preset.style
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <textarea
        id={id}
        name="voiceStyle"
        rows={2}
        value={style}
        onChange={(e) => setStyle(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    </>
  );
}
