"use client";

import { useActionState } from "react";
import { buttonClass } from "@/components/ui";
import { runTestJob, type TestJobState } from "./actions";

export function TestJobButton() {
  const [state, action, pending] = useActionState<TestJobState>(runTestJob, {});

  return (
    <form action={action} className="flex flex-col items-end gap-2">
      <button type="submit" disabled={pending} className={buttonClass("secondary")}>
        {pending ? "Mengirim..." : "Jalankan job uji"}
      </button>
      {state.error && <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>}
    </form>
  );
}
