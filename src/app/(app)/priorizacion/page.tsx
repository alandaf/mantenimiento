import { desc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, Panel, money } from "@/components/ui";
import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { hasApiKey } from "@/lib/ai/client";
import type { Prioritization } from "@/lib/ai/prioritize";
import { getOpenWorkOrders } from "@/lib/ai/tools";
import { RunButton } from "./run-button";

export const dynamic = "force-dynamic";

const BAND_STYLES: Record<string, string> = {
  critica: "text-bad-500",
  alta: "text-warn-500",
  media: "text-ink-300",
  baja: "text-ink-400",
};

export default async function PrioritizacionPage() {
  // Ocultar el enlace del menú no basta: hay que cerrar la página.
  await requireRole("tecnico");
  const [orders, [latest]] = await Promise.all([
    getOpenWorkOrders(),
    db
      .select()
      .from(aiInsights)
      .where(eq(aiInsights.scope, "priorizacion"))
      .orderBy(desc(aiInsights.createdAt))
      .limit(1),
  ]);

  const analysis = latest?.output as Prioritization | undefined;
  const byCode = new Map(orders.map((o) => [o.code, o]));
  const keyPresent = hasApiKey();

  return (
    <>
      <PageHeader
        title="Priorización asistida por IA"
        subtitle={`${orders.length} órdenes abiertas · score determinista + análisis de Gemini`}
        actions={<RunButton hasKey={keyPresent} />}
      />

      <div className="space-y-5 p-6">
        {!keyPresent && (
          <div className="rounded-lg border border-warn-500/30 bg-warn-500/10 px-4 py-3 text-sm text-warn-500">
            Falta <code className="font-mono">GEMINI_API_KEY</code> en{" "}
            <code className="font-mono">.env</code>. El score determinista de abajo ya
            funciona; el análisis de Gemini se activa al configurar la clave y reiniciar
            el contenedor <code className="font-mono">web</code>.
          </div>
        )}

        {analysis && (
          <>
            <Panel
              title="Resumen ejecutivo"
              hint={
                latest
                  ? `${latest.model} · ${new Intl.DateTimeFormat("es-PE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(latest.createdAt)}`
                  : undefined
              }
            >
              <p className="px-5 py-4 text-sm leading-relaxed text-ink-100">
                {analysis.resumen}
              </p>
              {analysis.alertas.length > 0 && (
                <ul className="space-y-1.5 border-t border-ink-800 px-5 py-4">
                  {analysis.alertas.map((alerta, i) => (
                    <li key={i} className="flex gap-2 text-sm text-warn-500">
                      <span aria-hidden>▲</span>
                      <span>{alerta}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Ranking priorizado" hint="ordenado por urgencia real">
              <ol className="divide-y divide-ink-800">
                {analysis.ranking.map((item) => {
                  const wo = byCode.get(item.code);
                  return (
                    <li key={item.code} className="flex gap-4 px-5 py-4">
                      <span className="num mt-0.5 w-6 shrink-0 text-lg font-bold text-brand-400">
                        {item.posicion}
                      </span>
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          {wo ? (
                            <Link
                              href={`/ordenes/${wo.id}`}
                              className="text-sm font-medium hover:text-brand-300"
                            >
                              {wo.title}
                            </Link>
                          ) : (
                            <span className="text-sm font-medium">{item.code}</span>
                          )}
                          <span className="num text-[11px] text-ink-400">
                            {item.code}
                          </span>
                          {wo && <Badge value={wo.criticality} />}
                        </div>

                        {wo && (
                          <p className="text-[11px] text-ink-400">
                            {wo.assetTag} · {wo.assetName} · {wo.ageDays} días abierta
                            {wo.repeatFailures90d > 1 &&
                              ` · ${wo.repeatFailures90d} fallas en 90d`}
                          </p>
                        )}

                        <p className="text-sm leading-relaxed text-ink-300">
                          {item.justificacion}
                        </p>

                        <p className="text-sm text-ok-500">
                          <span className="text-ink-400">Acción: </span>
                          {item.accion_recomendada}
                        </p>

                        {item.patron_detectado && (
                          <p className="rounded-md bg-bad-500/10 px-2.5 py-1.5 text-[11px] text-bad-500">
                            Patrón: {item.patron_detectado}
                          </p>
                        )}
                      </div>

                      <div className="num shrink-0 text-right">
                        <p className="text-xl font-bold">
                          {Math.round(item.score_ajustado)}
                        </p>
                        {wo && (
                          <p className="text-[11px] text-ink-400">
                            base {Math.round(wo.riskScore)}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </>
        )}

        <Panel
          title="Score de riesgo determinista"
          hint="calculado en el servidor, sin IA"
        >
          {orders.length === 0 ? (
            <EmptyState message="No hay órdenes de trabajo abiertas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-semibold">OT</th>
                    <th className="px-5 py-2.5 font-semibold">Activo</th>
                    <th className="px-5 py-2.5 font-semibold">Criticidad</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Días</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Fallas 90d</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Parada/h</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {orders.map((o) => (
                    <tr key={o.id} className="transition hover:bg-ink-850">
                      <td className="px-5 py-3">
                        <Link
                          href={`/ordenes/${o.id}`}
                          className="hover:text-brand-300"
                        >
                          <span className="num text-xs text-ink-400">{o.code}</span>{" "}
                          <span className="font-medium">{o.title}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-ink-400">{o.assetTag}</td>
                      <td className="px-5 py-3">
                        <Badge value={o.criticality} />
                      </td>
                      <td className="num px-5 py-3 text-right text-ink-300">
                        {Math.round(o.ageDays)}
                      </td>
                      <td className="num px-5 py-3 text-right text-ink-300">
                        {o.repeatFailures90d}
                      </td>
                      <td className="num px-5 py-3 text-right text-ink-300">
                        {money.format(o.downtimeCostPerHour)}
                      </td>
                      <td
                        className={`num px-5 py-3 text-right font-bold ${
                          BAND_STYLES[o.riskBand] ?? ""
                        }`}
                      >
                        {Math.round(o.riskScore)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
