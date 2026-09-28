"use client";

import { useState } from "react";

// Kolom JSON data grafis. Browser menolak menyimpan bila JSON tidak valid.
export function GraphicDataField({ defaultValue, disabled }: { defaultValue: string; disabled: boolean }) {
  const [error, setError] = useState<string | null>(null);
  return (
    <details className="text-xs">
      <summary className="cursor-pointer text-muted hover:text-foreground">
        Data grafis (JSON, untuk pengguna tingkat lanjut)
      </summary>
      <textarea
        name="graphicData"
        defaultValue={defaultValue}
        rows={10}
        disabled={disabled}
        spellCheck={false}
        onChange={(e) => {
          const text = e.target.value.trim();
          let message = "";
          try {
            if (text) JSON.parse(text);
          } catch (err) {
            message = `JSON tidak valid: ${(err as Error).message}`;
          }
          e.target.setCustomValidity(message);
          setError(message || null);
        }}
        className="field mt-2 font-mono text-xs"
      />
      {error && <p className="mt-1 text-red-600 dark:text-red-400">{error}</p>}
    </details>
  );
}
