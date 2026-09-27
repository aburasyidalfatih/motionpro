"use client";

import { useActionState } from "react";
import { runTestJob, type TestJobState } from "./actions";

export function TestJobButton() {
  const [state, action, pending] = useActionState<TestJobState>(runTestJob, {});

  return (
    <form action={action} className="space-y-2">
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Mengirim..." : "Jalankan job uji"}
      </button>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
