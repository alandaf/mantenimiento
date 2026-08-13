import Link from "next/link";
import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { getAvailableMonths } from "@/lib/report/monthly";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reportes" };

export default async function ReportesPage() {
  const months = await getAvailableMonths();

  return (
    <>
      <PageHeader
        title="Reportes"
        subtitle="Reporte mensual en PDF, listo para imprimir o enviar"
      />

      <div className="grid gap-5 p-6 xl:grid-cols-3">
        <Panel
          title="Reporte mensual"
          hint={`${months.length} meses con datos`}
          className="xl:col-span-2"
        >
          {months.length === 0 ? (
            <EmptyState message="Todavía no hay órdenes de trabajo que reportar." />
          ) : (
            <ul className="divide-y divide-ink-800">
              {months.map((m) => (
                <li
                  key={m.value}
                  className="flex items-center justify-between px-5 py-3.5 transition hover:bg-ink-850"
                >
                  <div>
                    <p className="text-sm font-medium capitalize">{m.label}</p>
                    <p className="num text-[11px] text-ink-400">{m.value}</p>
                  </div>
                  <Link
                    href={`/api/reportes/mensual?mes=${m.value}`}
                    prefetch={false}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
                  >
                    ↓ Descargar PDF
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Qué incluye">
          <ul className="space-y-2.5 px-5 py-4 text-xs leading-relaxed text-ink-300">
            <li>
              <span className="font-medium text-ink-100">Indicadores clave</span> —
              MTTR, MTBF, disponibilidad, cumplimiento del plan preventivo, trabajo
              reactivo, backlog y costo del periodo.
            </li>
            <li>
              <span className="font-medium text-ink-100">Distribución de OT</span> —
              correctivo, preventivo y predictivo, en número y horas.
            </li>
            <li>
              <span className="font-medium text-ink-100">Pareto de fallas</span> —
              con los pocos vitales que concentran el 80% de la parada marcados.
            </li>
            <li>
              <span className="font-medium text-ink-100">Activos con mayor impacto</span>{" "}
              — ranking por horas de parada y costo acumulado.
            </li>
            <li>
              <span className="font-medium text-ink-100">Fallas repetitivas</span> —
              patrones detectados con su cronicidad y tendencia.
            </li>
            <li>
              <span className="font-medium text-ink-100">Metodología</span> — cómo se
              calcula cada indicador, para que el reporte sea auditable por quien lo
              reciba.
            </li>
          </ul>
          <div className="border-t border-ink-800 px-5 py-3.5">
            <p className="text-[11px] leading-relaxed text-ink-400">
              El PDF usa exactamente las mismas consultas que el dashboard. Si la
              pantalla y el reporte divergieran, el reporte dejaría de servir para
              decidir.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
