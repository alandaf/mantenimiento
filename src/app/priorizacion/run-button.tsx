"use client";

import { useState, useTransition } from "react";
import { runPrioritization, type PrioritizeState } from "@/lib/actions/prioritize";

export function RunButton({ hasKey }: { hasKey: boolean }) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<PrioritizeState | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={pending || !hasKey}
        title={hasKey ? undefined : "Configura GEMINI_API_KEY en .env"}
        onClick={() =>
          startTransition(async () => {
            setState(null);
            setState(await runPrioritization());
          })
        }
        className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? (
          <>
            <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Analizando…
          </>
        ) : (
          "Priorizar con IA"
        )}
      </button>

      {state?.message && (
        <p
          className={`max-w-md text-right text-[11px] ${
            state.ok ? "text-ok-500" : "text-bad-500"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
