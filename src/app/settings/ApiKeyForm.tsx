"use client";

import { useActionState } from "react";
import { apiKeyAction, type ApiKeyFormState } from "./actions";

const field =
  "w-full rounded-md border border-zinc-300 bg-transparent px-2.5 py-1.5 font-mono text-sm dark:border-zinc-700";
const button =
  "rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800";

// Formulir satu API key. Key tidak pernah dikirim balik ke browser; kolom
// dikosongkan setelah disimpan.
export function ApiKeyForm({
  name,
  placeholder,
  hasValue,
  removable,
}: {
  name: string;
  placeholder: string;
  hasValue: boolean;
  removable: boolean;
}) {
  const [state, action, pending] = useActionState<ApiKeyFormState, FormData>(apiKeyAction, {});

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="name" value={name} />
      <div className="flex flex-wrap gap-2">
        <input
          name="value"
          type="password"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          aria-label={name}
          className={`${field} min-w-64 flex-1`}
        />
        <button
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Memproses..." : "Simpan"}
        </button>
        <button type="submit" name="intent" value="test" disabled={pending || !hasValue} className={button}>
          Uji koneksi
        </button>
        {removable && (
          <button
            type="submit"
            name="intent"
            value="remove"
            disabled={pending}
            className={`${button} text-red-600 dark:text-red-400`}
          >
            Hapus
          </button>
        )}
      </div>
      {state.message && (
        <p
          role="status"
          className={`text-sm ${state.ok ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
