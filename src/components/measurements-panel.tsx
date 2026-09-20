import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { measurements } from "@/db/schema";
import { Panel } from "@/components/ui";
import { getActiveOrgId } from "@/lib/org";

/**
 * Mediciones de una intervención, agrupadas por variable.
 *
 * Se muestran antes y después juntas porque la comparación es el dato: "la
 * vibración pasó de 13,6 a 2,8 mm/s" dice algo que ninguna de las dos cifras
 * dice por separado.
 */
export async function MeasurementsPanel({
  workOrderId,
}: {
  workOrderId: number;
}) {
  const orgId = await getActiveOrgId();
  const filas = await db
    .select()
    .from(measurements)
    .where(
      and(
        eq(measurements.organizationId, orgId),
        eq(measurements.workOrderId, workOrderId),
      ),
    )
    .orderBy(asc(measurements.variable), asc(measurements.takenAt));

  if (filas.length === 0) return null;

  // Agrupadas por variable para poder enfrentar el antes con el después.
  const porVariable = new Map<string, typeof filas>();
  for (const f of filas) {
    const lista = porVariable.get(f.variable) ?? [];
    lista.push(f);
    porVariable.set(f.variable, lista);
  }

  return (
    <Panel title="Mediciones" hint="antes y después de intervenir">
      <div className="divide-y divide-ink-800">
        {[...porVariable.entries()].map(([variable, lecturas]) => {
          const antes = lecturas.find((l) => l.moment === "antes");
          const despues = lecturas.find((l) => l.moment === "despues");
          const umbral = antes?.threshold ?? despues?.threshold;

          const fuera = (v: string | null | undefined) =>
            v !== null && v !== undefined && umbral !== null && umbral !== undefined
              ? Number(v) > Number(umbral)
              : false;

          return (
            <div key={variable} className="px-5 py-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-medium text-ink-100">{variable}</span>
                {umbral !== null && umbral !== undefined && (
                  <span className="num text-[11px] text-ink-400">
                    límite {Number(umbral)} {antes?.unit ?? despues?.unit}
                  </span>
                )}
              </div>

              <div className="mt-1.5 flex items-baseline gap-3">
                {antes && (
                  <span
                    className={`num text-sm font-semibold ${
                      fuera(antes.value) ? "text-bad-500" : "text-ink-200"
                    }`}
                  >
                    {Number(antes.value)} {antes.unit}
                  </span>
                )}
                {antes && despues && (
                  <span className="text-ink-600">→</span>
                )}
                {despues && (
                  <span
                    className={`num text-sm font-semibold ${
                      fuera(despues.value) ? "text-bad-500" : "text-ok-500"
                    }`}
                  >
                    {Number(despues.value)} {despues.unit}
                  </span>
                )}
                {!despues && (
                  <span className="text-[11px] text-ink-400">
                    sin medición posterior
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
