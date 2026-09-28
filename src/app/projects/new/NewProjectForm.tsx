"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { toneOptions } from "@/lib/labels";
import { createProject, type NewProjectState } from "./actions";

const field =
  "mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700";

export function NewProjectForm() {
  const [state, action] = useActionState<NewProjectState, FormData>(createProject, {});

  return (
    <form action={action} className="max-w-xl space-y-5">
      <label className="block text-sm font-medium">
        Topik video
        <input
          name="topic"
          required
          minLength={5}
          maxLength={200}
          placeholder="Contoh: Kejayaan dan keruntuhan Majapahit"
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

      <label className="block text-sm font-medium">
        Template
        <select disabled className={`${field} opacity-60`}>
          <option>Sejarah: peta dan lukisan (gaya Kings and Generals / Epic History TV)</option>
        </select>
      </label>

      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}

      <SubmitButton pendingText="Membuat proyek...">Buat proyek dan mulai riset</SubmitButton>
    </form>
  );
}
