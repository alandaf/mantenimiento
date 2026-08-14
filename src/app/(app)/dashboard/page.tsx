import Link from "next/link";
import { getFormatters } from "@/lib/config";
import { AvailabilityTrend, ParetoChart, WorkOrderMix } from "@/components/charts";
import {
  Badge,
  EmptyState,
  KpiCard,
  PageHeader,
  Panel,
} from "@/components/ui";
import { formatHours, toPercent } from "@/lib/kpi/formulas";
import { formatPeriod, lastDays } from "@/lib/kpi/period";
import {
  getAvailabilityTrend,
  getBadActors,
  getFailurePareto,
  getKpiSummary,
  getWorkOrderMix,
} from "@/lib/kpi/queries";

// Los KPIs se recalculan en cada visita: son la fuente de verdad operativa.
export const dynamic = "force-dynamic";

const RANGES = [
  { days: 30, label: "30 días" },
  { days: 90, label: "90 días" },
  { days: 365, label: "12 meses" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ rango?: string }>;
}) {
  const { money } = await getFormatters();
  const params = await searchParams;
  const days = RANGES.some((r) => String(r.days) === params.rango)
    ? Number(params.rango)
    : 90;
  const period = lastDays(days);

  const [summary, trend, paretoData, badActors, mix] = await Promise.all([
    getKpiSummary(period),
    getAvailabilityTrend(12),
    getFailurePareto(period),
    getBadActors(period),
    getWorkOrderMix(period),
  ]);

  const availability = summary.operationalAvailability;
  const availabilityTone =
    availability === null ? "neutral" : availability >= 0.95 ? "good" : availability >= 0.9 ? "warn" : "bad";
  const pmTone =
    summary.pmCompliance === null
      ? "neutral"
      : summary.pmCompliance >= 0.9
        ? "good"
        : summary.pmCompliance >= 0.75
          ? "warn"
          : "bad";
  const reactiveTone =
    summary.correctiveRatio === null
      ? "neutral"
      : summary.correctiveRatio <= 0.3
        ? "good"
        : summary.correctiveRatio <= 0.5
          ? "warn"
          : "bad";

  const vitalFew = paretoData.filter((p) => p.isVital);

  return (
    <>
      <PageHeader
        title="Dashboard de mantenimiento"
        subtitle={formatPeriod(period)}
        actions={
          <div className="flex rounded-lg border border-ink-700 p-0.5">
            {RANGES.map((r) => (
              <Link
                key={r.days}
                href={`/dashboard?rango=${r.days}`}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  r.days === days
                    ? "bg-brand-500 text-white"
                    : "text-ink-400 hover:text-ink-100"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        }
      />

      <div className="space-y-5 p-6">
        {/* Indicadores clave */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="MTTR"
            term="mttr"
            value={formatHours(summary.mttrHours)}
            tone="neutral"
            footnote="Tiempo medio de reparación de correctivas"
          />
          <KpiCard
            label="MTBF"
            term="mtbf"
            value={formatHours(summary.mtbfHours)}
            tone="neutral"
            footnote={`${summary.failureCount} fallas en el periodo`}
          />
          <KpiCard
            label="Disponibilidad"
            term="disponibilidad"
            value={toPercent(availability)}
            tone={availabilityTone}
            footnote={`Inherente: ${toPercent(summary.inherentAvailability)}`}
          />
          <KpiCard
            label="Backlog"
            term="backlog"
            value={formatHours(summary.backlogHours)}
            tone={summary.backlogHours > 200 ? "warn" : "neutral"}
            footnote={`${summary.openWorkOrders} OT abiertas`}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Cumplimiento PMP"
            term="cumplimiento_pmp"
            value={toPercent(summary.pmCompliance)}
            tone={pmTone}
            footnote="Preventivas ejecutadas vs. programadas"
          />
          <KpiCard
            label="Trabajo reactivo"
            term="trabajo_reactivo"
            value={toPercent(summary.correctiveRatio)}
            tone={reactiveTone}
            footnote="Horas correctivas sobre el total"
          />
          <KpiCard
            label="Costo de mantenimiento"
            term="costo_parada"
            value={money.format(summary.totalCost)}
            footnote="Mano de obra + repuestos"
          />
          <KpiCard
            label="Activos críticos"
            term="criticidad"
            value={String(badActors.filter((a) => a.criticality === "A").length)}
            footnote="Clase A con fallas en el periodo"
          />
        </div>

        {/* Tendencia + mix */}
        <div className="grid gap-5 xl:grid-cols-3">
          <Panel
            title="Tendencia de disponibilidad"
            hint="últimos 12 meses"
            className="xl:col-span-2"
          >
            <div className="px-3 py-4">
              <AvailabilityTrend data={trend} />
            </div>
          </Panel>

          <Panel title="Distribución de OT" hint={`${days} días`} term="ot">
            <div className="px-3 py-4">
              {mix.length === 0 ? (
                <EmptyState message="Sin órdenes en el periodo." />
              ) : (
                <WorkOrderMix data={mix} />
              )}
            </div>
          </Panel>
        </div>

        {/* Pareto */}
        <div className="grid gap-5 xl:grid-cols-3">
          <Panel
            title="Pareto de modos de falla"
            hint="por horas de parada"
            className="xl:col-span-2"
          >
            <div className="px-3 py-4">
              {paretoData.length === 0 ? (
                <EmptyState message="Sin fallas registradas con modo identificado." />
              ) : (
                <ParetoChart data={paretoData} />
              )}
            </div>
          </Panel>

          <Panel title="Los pocos vitales" hint="80% del impacto" term="pareto">
            {vitalFew.length === 0 ? (
              <EmptyState message="Sin datos suficientes." />
            ) : (
              <ul className="divide-y divide-ink-800">
                {vitalFew.slice(0, 6).map((item, i) => (
                  <li key={item.label} className="flex items-start gap-3 px-5 py-3">
                    <span className="num mt-0.5 w-5 shrink-0 text-sm font-bold text-bad-500">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.label}</p>
                      <p className="mt-0.5 text-[11px] text-ink-400">
                        {item.occurrences}{" "}
                        {item.occurrences === 1 ? "evento" : "eventos"} ·{" "}
                        {item.category}
                      </p>
                    </div>
                    <div className="num shrink-0 text-right">
                      <p className="text-sm font-semibold">
                        {Math.round(item.value)} h
                      </p>
                      <p className="text-[11px] text-ink-400">
                        {item.percentage.toFixed(0)}%
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Malos actores */}
        <Panel title="Malos actores" hint="activos con mayor impacto acumulado" term="modo_falla">
          {badActors.length === 0 ? (
            <EmptyState message="Sin fallas registradas en el periodo." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-semibold">Activo</th>
                    <th className="px-5 py-2.5 font-semibold">Criticidad</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Fallas</th>
                    <th className="px-5 py-2.5 text-right font-semibold">MTTR</th>
                    <th className="px-5 py-2.5 text-right font-semibold">MTBF</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Parada</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Costo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {badActors.map((a) => (
                    <tr key={a.assetId} className="transition hover:bg-ink-850">
                      <td className="px-5 py-3">
                        <Link
                          href={`/ordenes?activo=${a.assetId}`}
                          className="hover:text-brand-300"
                        >
                          <span className="num text-ink-400">{a.tag}</span>{" "}
                          <span className="font-medium">{a.name}</span>
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={a.criticality} />
                      </td>
                      <td className="num px-5 py-3 text-right">{a.failures}</td>
                      <td className="num px-5 py-3 text-right text-ink-300">
                        {formatHours(a.mttrHours)}
                      </td>
                      <td className="num px-5 py-3 text-right text-ink-300">
                        {formatHours(a.mtbfHours)}
                      </td>
                      <td className="num px-5 py-3 text-right font-medium">
                        {Math.round(a.downtimeHours)} h
                      </td>
                      <td className="num px-5 py-3 text-right">
                        {money.format(a.cost)}
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
