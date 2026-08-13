import type { RootCauseAnalysis } from "@/lib/ai/rca";

const CONFIDENCE = {
  alta: { label: "Confianza alta", cls: "bg-ok-500/15 text-ok-500 ring-ok-500/30" },
  media: { label: "Confianza media", cls: "bg-warn-500/15 text-warn-500 ring-warn-500/30" },
  baja: { label: "Confianza baja", cls: "bg-bad-500/15 text-bad-500 ring-bad-500/30" },
} as const;

const BRANCH_LABELS: Record<string, string> = {
  maquina: "Máquina",
  metodo: "Método",
  material: "Material",
  mano_de_obra: "Mano de obra",
  medicion: "Medición",
  medio_ambiente: "Medio ambiente",
};

const ACTION_TYPE: Record<string, string> = {
  correctiva: "text-bad-500",
  preventiva: "text-ok-500",
  predictiva: "text-brand-300",
  rediseno: "text-warn-500",
};

const PLAZO: Record<string, string> = {
  inmediato: "Inmediato",
  corto: "Corto plazo",
  medio: "Medio plazo",
};

/** Marca las respuestas que el modelo declaró como hipótesis sin respaldo. */
function isHypothesis(evidencia: string): boolean {
  return /hip[oó]tesis|falta evidencia|sin evidencia/i.test(evidencia);
}

export function RcaDetail({ analysis }: { analysis: RootCauseAnalysis }) {
  const confidence = CONFIDENCE[analysis.confianza];

  return (
    <div className="space-y-5 border-t border-ink-800 bg-ink-950/40 px-5 py-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-100">{analysis.problema}</p>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${confidence.cls}`}
        >
          {confidence.label}
        </span>
      </div>

      {/* 5 Porqués */}
      <section>
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
          5 Porqués
        </h3>
        <ol className="space-y-2.5">
          {analysis.cinco_porques.map((step) => (
            <li key={step.nivel} className="flex gap-3">
              <span className="num mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-ink-800 text-[10px] font-bold text-ink-300">
                {step.nivel}
              </span>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-xs text-ink-400">{step.por_que}</p>
                <p className="text-sm text-ink-100">{step.respuesta}</p>
                <p
                  className={`text-[11px] ${
                    isHypothesis(step.evidencia) ? "text-warn-500" : "text-ink-400"
                  }`}
                >
                  {isHypothesis(step.evidencia) ? "⚠ " : "✓ "}
                  {step.evidencia}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Ishikawa */}
      <section>
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
          Ishikawa · 6M
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(analysis.ishikawa).map(([branch, causes]) => (
            <div
              key={branch}
              className="rounded-lg border border-ink-800 bg-ink-900 p-3"
            >
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-brand-300">
                {BRANCH_LABELS[branch] ?? branch}
              </p>
              {causes.length === 0 ? (
                <p className="text-[11px] text-ink-600">Sin causas identificadas</p>
              ) : (
                <ul className="space-y-1">
                  {causes.map((c, i) => (
                    <li key={i} className="text-xs leading-relaxed text-ink-300">
                      · {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Causa raíz */}
      <section className="rounded-lg border border-brand-500/30 bg-brand-500/10 p-4">
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-brand-300">
          Causa raíz probable
        </h3>
        <p className="text-sm leading-relaxed text-ink-100">
          {analysis.causa_raiz_probable}
        </p>
        <p className="mt-2 text-[11px] text-ink-400">
          {analysis.por_que_esa_confianza}
        </p>
      </section>

      {/* Acciones */}
      <section>
        <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-ink-300">
          Acciones propuestas
        </h3>
        <ul className="space-y-2">
          {analysis.acciones.map((a, i) => (
            <li
              key={i}
              className="rounded-lg border border-ink-800 bg-ink-900 px-3.5 py-2.5"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider ${
                    ACTION_TYPE[a.tipo] ?? "text-ink-400"
                  }`}
                >
                  {a.tipo}
                </span>
                <span className="text-[10px] text-ink-400">
                  {PLAZO[a.plazo] ?? a.plazo}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-100">{a.accion}</p>
              <p className="mt-0.5 text-[11px] text-ink-400">{a.justificacion}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* Datos faltantes */}
      {analysis.datos_faltantes.length > 0 && (
        <section className="rounded-lg border border-warn-500/25 bg-warn-500/5 p-3.5">
          <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-warn-500">
            Para cerrar el análisis haría falta registrar
          </h3>
          <ul className="space-y-0.5">
            {analysis.datos_faltantes.map((d, i) => (
              <li key={i} className="text-xs text-ink-300">
                · {d}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
