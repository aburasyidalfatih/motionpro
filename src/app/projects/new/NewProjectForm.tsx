"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { styleOptions, toneOptions } from "@/lib/labels";
import { createProject, type NewProjectState } from "./actions";

const field = "field mt-1.5";

export function NewProjectForm() {
  const [state, action] = useActionState<NewProjectState, FormData>(createProject, {});

  return (
    <form action={action} className="space-y-5">
      <label className="block text-sm font-medium">
        Topik video
        <input
          name="topic"
          required
          minLength={5}
          maxLength={200}
          placeholder="Contoh: Pertempuran Surabaya 1945, atau Kenapa Laut China Selatan diperebutkan?"
          className={field}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Durasi target (menit)
          <input name="targetMinutes" type="number" min={1} max={15} defaultValue={10} className={field} />
        </label>
        <label className="block text-sm font-medium">
          Bahasa narasi
          <select name="language" defaultValue="id" className={field}>
            <option value="id">Bahasa Indonesia</option>
            <option value="en">English</option>
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium">
        Gaya bahasa
        <select name="tone" defaultValue="dokumenter" className={field}>
          {toneOptions.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Gaya video</legend>
        {styleOptions.map((option, i) => (
          <label
            key={option.value}
            className="flex cursor-pointer gap-3 rounded-lg border border-border p-3 text-sm transition hover:border-accent/50 has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
          >
            <input
              type="radio"
              name="style"
              value={option.value}
              defaultChecked={i === 0}
              className="mt-1 accent-[var(--accent)]"
            />
            <span>
              <span className="font-medium">{option.label}</span>
              <span className="block text-muted">{option.description}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <div className="border-t border-border pt-5">
        <SubmitButton pendingText="Membuat proyek...">Buat proyek dan mulai riset →</SubmitButton>
      </div>
    </form>
  );
}
