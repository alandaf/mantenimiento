import { sql } from "drizzle-orm";
import { getFormatters } from "@/lib/config";
import { requireRole } from "@/lib/session";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, Panel} from "@/components/ui";
import { db } from "@/db";
import { hasApiKey } from "@/lib/ai/client";
import type { RootCauseAnalysis } from "@/lib/ai/rca";
import { getFailurePatterns } from "@/lib/kpi/patterns";
import { RcaButton } from "./rca-button";
import { RcaDetail } from "./rca-detail";

export const dynamic = "force-dynamic";

const BAND_STYLES: Record<string, string> = {
  cronica: "bg-bad-500/15 text-bad-500 ring-bad-500/30",
  recurrente: "bg-warn-500/15 text-warn-500 ring-warn-500/30",
  aislada: "bg-ink-700 text-ink-300 ring-ink-600",
};

const TREND_LABELS: Record<string, { text: string; cls: string }> = {
  acelerando: { text: "↑ Acelerando", cls: "text-bad-500" },
  estable: { text: "→ Estable", cls: "text-ink-400" },
  desacelerando: { text: "↓ Desacelerando", cls: "text-ok-500" },
  indeterminada: { text: "· Serie corta", cls: "text-ink-600" },
};

/** Último RCA guardado por clave de patrón. */
async function getLatestAnalyses(): Promise<
  Map<string, { output: RootCauseAnalysis; model: string; createdAt: Date }>
> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT ON (input_data->'pattern'->>'key')
      input_data->'pattern'->>'key' AS key,
      output, model, created_at
    FROM ai_insights
    WHERE scope = 'rca'
    ORDER BY input_data->'pattern'->>'key', created_at DESC
  `)) as unknown as Array<{
    key: string;
    output: RootCauseAnalysis;
    model: string;
    created_at: Date;
  }>;

  return new Map(
    rows.map((r) => [
      r.key,
      { output: r.output, model: r.model, createdAt: new Date(r.created_at) },
    ]),
  );
}

export default async function CausaRaizPage() {
  const { money } = await getFormatters();
  // Ocultar el enlace del menú no basta: hay que cerrar la página.
  await requireRole("tecnico");
  const [patterns, analyses] = await Promise.all([
    getFailurePatterns(),
    getLatestAnalyses(),
  ]);
  const keyPresent = hasApiKey();

  const chronic = patterns.filter((p) => p.band === "cronica").length;
  const accelerating = patterns.filter((p) => p.trend === "acelerando").length;

  return (
    <>
      <PageHeader
        title="Análisis de causa raíz"
        subtitle={`${patterns.length} patrones repetitivos · ${chronic} crónicos · ${accelerating} acelerando`}
      />

      <div className="space-y-5 p-6">
        {!keyPresent && (
          <div className="rounded-lg border border-warn-500/30 bg-warn-500/10 px-4 py-3 text-sm text-warn-500">
            Falta <code className="font-mono">GEMINI_API_KEY</code> en{" "}
            <code className="font-mono">.env</code>. La detección de patrones de abajo
            ya funciona; el análisis de causa raíz se activa al configurar la clave.
          </div>
        )}

        <Panel
          title="Patrones de falla repetitiva"
          hint="mismo modo de falla, mismo activo · últimos 12 meses"
        >
          {patterns.length === 0 ? (
            <EmptyState message="No se detectaron fallas repetitivas en el periodo." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {patterns.map((p) => {
                const analysis = analyses.get(p.key);
                const trend = TREND_LABELS[p.trend];

                return (
                  <li key={p.key}>
                    <div className="flex flex-wrap items-start gap-4 px-5 py-4">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium">{p.failureMode}</span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ring-1 ring-inset ${
                              BAND_STYLES[p.band]
                            }`}
                          >
                            {p.band}
                          </span>
                          <Badge value={p.criticality} />
                          <span className={`text-[11px] font-medium ${trend.cls}`}>
                            {trend.text}
                          </span>
                        </div>

                        <p className="text-[11px] text-ink-400">
                          <Link
                            href={`/ordenes?activo=${p.assetId}`}
                            className="hover:text-brand-300"
                          >
                            {p.assetTag} · {p.assetName}
                          </Link>
                          {" — "}
                          {p.category}
                        </p>

                        <div className="flex flex-wrap gap-x-5 gap-y-1 pt-0.5 text-[11px] text-ink-400">
                          <span>
                            <span className="num font-semibold text-ink-100">
                              {p.occurrences}
                            </span>{" "}
                            ocurrencias
                          </span>
                          <span>
                            <span className="num font-semibold text-ink-100">
                              {Math.round(p.downtimeHours)} h
                            </span>{" "}
                            de parada
                          </span>
                          <span>
                            <span className="num font-semibold text-ink-100">
                              {money.format(p.cost)}
                            </span>{" "}
                            acumulados
                          </span>
                          {p.meanIntervalDays !== null && (
                            <span>
                              cada{" "}
                              <span className="num font-semibold text-ink-100">
                                {Math.round(p.meanIntervalDays)} días
                              </span>
                            </span>
                          )}
                          {p.nextExpected &&
                            (() => {
                              // Una proyección vencida no se muestra como futura:
                              // significa que el activo ya superó su cadencia
                              // histórica sin fallar, y eso es otra lectura.
                              const due = new Date(`${p.nextExpected}T00:00:00Z`);
                              const overdue = due.getTime() < Date.now();
                              return overdue ? (
                                <span className="text-ink-500">
                                  cadencia superada desde{" "}
                                  <span className="num">{p.nextExpected}</span>
                                </span>
                              ) : (
                                <span>
                                  próxima esperada{" "}
                                  <span className="num text-warn-500">
                                    {p.nextExpected}
                                  </span>
                                </span>
                              );
                            })()}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-start gap-4">
                        <div className="num text-right">
                          <p className="text-xl font-bold">{Math.round(p.priority)}</p>
                          <p className="text-[10px] uppercase tracking-wider text-ink-400">
                            prioridad
                          </p>
                        </div>
                        <RcaButton
                          patternKey={p.key}
                          hasKey={keyPresent}
                          hasAnalysis={Boolean(analysis)}
                        />
                      </div>
                    </div>

                    {analysis && <RcaDetail analysis={analysis.output} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}
