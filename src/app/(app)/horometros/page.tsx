import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { requireRole } from "@/lib/session";
import { dateFmt } from "@/lib/config";
import { getAssetMeters } from "@/lib/kpi/meter-queries";
import { ReadingForm } from "./reading-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Horómetros · GMAO-AI" };

/** Una lectura vieja hace que el ritmo proyectado deje de ser confiable. */
const STALE_DAYS = 30;

export default async function HorometrosPage() {
  // Ocultar el enlace del menú no basta: hay que cerrar la página.
  await requireRole("tecnico");
  const meters = await getAssetMeters();
  const stale = meters.filter(
    (m) => m.staleDays === null || m.staleDays > STALE_DAYS,
  );

  return (
    <>
      <PageHeader
        title="Horómetros"
        subtitle={`${meters.length} activos con horómetro · ${stale.length} sin lectura reciente`}
      />

      <div className="grid gap-5 p-6 xl:grid-cols-3">
        <Panel
          title="Lecturas por activo"
          hint="ritmo calculado sobre los últimos 90 días"
          className="xl:col-span-2"
        >
          {meters.length === 0 ? (
            <EmptyState message="Ningún activo tiene horómetro habilitado. Márcalo en la ficha del activo." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-semibold">Activo</th>
                    <th className="px-5 py-2.5 font-semibold">Crit.</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Horómetro</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Ritmo</th>
                    <th className="px-5 py-2.5 text-right font-semibold">
                      Última lectura
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {meters.map((m) => {
                    const isStale =
                      m.staleDays === null || m.staleDays > STALE_DAYS;
                    return (
                      <tr key={m.assetId} className="transition hover:bg-ink-850">
                        <td className="px-5 py-3">
                          <span className="num text-xs text-ink-400">{m.tag}</span>{" "}
                          <span className="font-medium">{m.name}</span>
                          {m.location && (
                            <span className="mt-0.5 block text-[11px] text-ink-600">
                              {m.location}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Badge value={m.criticality} />
                        </td>
                        <td className="num px-5 py-3 text-right font-semibold">
                          {m.currentHours === null
                            ? "—"
                            : `${Math.round(m.currentHours).toLocaleString()} h`}
                        </td>
                        <td className="num px-5 py-3 text-right">
                          {m.ratePerDay === null ? (
                            <span className="text-ink-600">—</span>
                          ) : m.ratePerDay === 0 ? (
                            <span className="text-ink-400">detenido</span>
                          ) : (
                            <span className="text-ink-300">
                              {m.ratePerDay.toFixed(1)} h/día
                            </span>
                          )}
                        </td>
                        <td className="num px-5 py-3 text-right">
                          {m.lastReadingAt === null ? (
                            <span className="text-bad-500">sin lecturas</span>
                          ) : (
                            <span className={isStale ? "text-warn-500" : "text-ink-400"}>
                              {dateFmt.format(m.lastReadingAt)}
                              {isStale && ` · ${m.staleDays}d`}
                            </span>
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

        <div className="space-y-5">
          <Panel title="Registrar lectura">
            <ReadingForm
              assets={meters.map((m) => ({
                id: m.assetId,
                tag: m.tag,
                name: m.name,
                currentHours: m.currentHours,
              }))}
            />
          </Panel>

          <Panel title="Por qué importa">
            <div className="space-y-2.5 px-5 py-4 text-xs leading-relaxed text-ink-300">
              <p>
                El mantenimiento de equipos rotativos no se programa por
                calendario sino por <span className="text-ink-100">horas de marcha</span>.
                Un auxiliar que estuvo tres meses en dique no necesita su rutina
                de 500 h; uno que hizo dos travesías seguidas la necesita antes.
              </p>
              <p>
                Con el ritmo de uso real el sistema traduce{" "}
                <span className="text-ink-100">«vence a las 12.500 h»</span> en una
                fecha concreta, que es lo que permite pedir repuestos y conseguir
                ventana de trabajo a tiempo.
              </p>
              <p className="text-ink-400">
                Se guardan lecturas, no un contador: así una cifra mal tecleada se
                corrige sin perder la serie, y el ritmo se calcula sobre datos
                reales.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
