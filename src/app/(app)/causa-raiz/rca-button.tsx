"use client";

import { useState, useTransition } from "react";
import { runRootCauseAnalysis, type RcaState } from "@/lib/actions/rca";

export function RcaButton({
  patternKey,
  hasKey,
  hasAnalysis,
}: {
  patternKey: string;
  hasKey: boolean;
  hasAnalysis: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<RcaState | null>(null);

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        disabled={pending || !hasKey}
        title={hasKey ? undefined : "Configura GEMINI_API_KEY en .env"}
        onClick={() =>
          startTransition(async () => {
            setState(null);
            setState(await runRootCauseAnalysis(patternKey));
          })
        }
        className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
          hasAnalysis
            ? "border border-ink-700 text-ink-300 hover:bg-ink-800 hover:text-ink-100"
            : "bg-brand-500 text-white hover:bg-brand-600"
        }`}
      >
        {pending ? (
          <>
            <span className="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
            Analizando…
          </>
        ) : hasAnalysis ? (
          "Reanalizar"
        ) : (
          "Analizar causa raíz"
        )}
      </button>

      {state?.message && (
        <p
          className={`max-w-xs text-right text-[11px] ${
            state.ok ? "text-ok-500" : "text-bad-500"
          }`}
        >
          {state.message}
        </p>
      )}
    </div>
  );
}
