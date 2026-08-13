import Link from "next/link";
import { Badge, EmptyState, KpiCard, PageHeader, Panel } from "@/components/ui";
import { dateFmt } from "@/lib/config";
import { getPmPlanStatuses } from "@/lib/kpi/meter-queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plan preventivo" };

const TRIGGER_LABEL: Record<string, string> = {
  calendario: "Calendario",
  horas: "Horas de marcha",
  ambos: "Lo que llegue primero",
};

export default async function PreventivoPage() {
  const plans = await getPmPlanStatuses();

  const overdue = plans.filter((p) => p.status.overdue);
  const soon = plans.filter(
    (p) =>
      !p.status.overdue &&
      p.status.remainingDays !== null &&
      p.status.remainingDays <= 14,
  );
  const byHours = plans.filter((p) => p.trigger !== "calendario");

  return (
    <>
      <PageHeader
        title="Plan preventivo"
        subtitle={`${plans.length} rutinas activas · ${byHours.length} disparadas por horas de marcha`}
      />

      <div className="space-y-5 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            label="Vencidas"
            value={String(overdue.length)}
            tone={overdue.length > 0 ? "bad" : "good"}
            footnote="Requieren acción inmediata"
          />
          <KpiCard
            label="Vencen en 14 días"
            value={String(soon.length)}
            tone={soon.length > 0 ? "warn" : "neutral"}
            footnote="Ventana para conseguir repuestos"
          />
          <KpiCard
            label="Por horas de marcha"
            value={String(byHours.length)}
            footnote="Rutinas que el calendario no captura"
          />
          <KpiCard
            label="Rutinas activas"
            value={String(plans.length)}
            footnote="En toda la instalación"
          />
        </div>

        <Panel
          title="Rutinas por vencer"
          hint="ordenadas por urgencia real, no por fecha nominal"
        >
          {plans.length === 0 ? (
            <EmptyState message="No hay planes preventivos activos." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-semibold">Rutina</th>
                    <th className="px-5 py-2.5 font-semibold">Disparador</th>
                    <th className="px-5 py-2.5 text-right font-semibold">
                      Horas restantes
                    </th>
                    <th className="px-5 py-2.5 text-right font-semibold">
                      Vence (estimado)
                    </th>
                    <th className="px-5 py-2.5 text-right font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {plans.map((p) => {
                    const s = p.status;
                    return (
                      <tr key={p.planId} className="transition hover:bg-ink-850">
                        <td className="px-5 py-3">
                          <span className="font-medium">{p.name}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-400">
                            <Link
                              href={`/ordenes?activo=${p.assetId}`}
                              className="hover:text-brand-300"
                            >
                              {p.assetTag} · {p.assetName}
                            </Link>
                            <Badge value={p.criticality} />
                          </span>
                        </td>

                        <td className="px-5 py-3">
                          <span className="text-xs text-ink-300">
                            {TRIGGER_LABEL[p.trigger]}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-ink-600">
                            {p.frequencyHours && `cada ${p.frequencyHours.toLocaleString()} h`}
                            {p.frequencyHours && p.frequencyDays && " · "}
                            {p.frequencyDays && `cada ${p.frequencyDays} días`}
                          </span>
                        </td>

                        <td className="num px-5 py-3 text-right">
                          {s.remainingHours === null ? (
                            <span className="text-ink-600">—</span>
                          ) : (
                            <span
                              className={
                                s.remainingHours <= 0
                                  ? "font-semibold text-bad-500"
                                  : s.remainingHours < 100
                                    ? "text-warn-500"
                                    : "text-ink-300"
                              }
                            >
                              {Math.round(s.remainingHours).toLocaleString()} h
                            </span>
                          )}
                        </td>

                        <td className="num px-5 py-3 text-right">
                          {s.dueDate === null ? (
                            // Rutina por horas con el equipo detenido: no vence.
                            <span className="text-ink-600" title="Equipo detenido">
                              sin uso
                            </span>
                          ) : (
                            <span
                              className={
                                s.overdue ? "text-bad-500" : "text-ink-300"
                              }
                            >
                              {dateFmt.format(s.dueDate)}
                              {s.remainingDays !== null && (
                                <span className="ml-1.5 text-[11px] text-ink-500">
                                  {s.remainingDays >= 0
                                    ? `en ${Math.round(s.remainingDays)}d`
                                    : `hace ${Math.abs(Math.round(s.remainingDays))}d`}
                                </span>
                              )}
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3 text-right">
                          {s.overdue ? (
                            <span className="rounded-full bg-bad-500/15 px-2 py-0.5 text-[11px] font-medium text-bad-500 ring-1 ring-inset ring-bad-500/30">
                              Vencida por {s.drivenBy}
                            </span>
                          ) : s.remainingDays !== null && s.remainingDays <= 14 ? (
                            <span className="rounded-full bg-warn-500/15 px-2 py-0.5 text-[11px] font-medium text-warn-500 ring-1 ring-inset ring-warn-500/30">
                              Próxima
                            </span>
                          ) : (
                            <span className="text-[11px] text-ink-600">Al día</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
