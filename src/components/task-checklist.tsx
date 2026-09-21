import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workOrderTasks } from "@/db/schema";
import { Panel } from "@/components/ui";
import { getActiveOrgId } from "@/lib/org";

/**
 * Pauta de la rutina: los pasos que hay que ejecutar en el equipo.
 *
 * Es la diferencia entre un sistema que avisa "toca la rutina de 500 horas" y
 * uno que le dice al mecánico qué hacer cuando llega. Y al cerrarla, deja
 * constancia de **qué se revisó de verdad** y no solo de que la orden se
 * cerró.
 */

const TIPOS: Record<string, { texto: string; cls: string }> = {
  verificacion: { texto: "Verificar", cls: "bg-ink-700 text-ink-300" },
  medicion: { texto: "Medir", cls: "bg-brand-500/15 text-brand-300" },
  reemplazo: { texto: "Reemplazar", cls: "bg-warn-500/15 text-warn-500" },
  intervencion: { texto: "Intervenir", cls: "bg-ink-700 text-ink-300" },
  registro: { texto: "Registrar", cls: "bg-ink-700 text-ink-400" },
};

const RESULTADOS: Record<string, { texto: string; cls: string }> = {
  conforme: { texto: "Conforme", cls: "text-ok-500" },
  no_conforme: { texto: "No conforme", cls: "text-bad-500" },
  no_aplica: { texto: "No aplica", cls: "text-ink-500" },
};

export async function TaskChecklist({ workOrderId }: { workOrderId: number }) {
  const orgId = await getActiveOrgId();
  const pasos = await db
    .select()
    .from(workOrderTasks)
    .where(
      and(
        eq(workOrderTasks.organizationId, orgId),
        eq(workOrderTasks.workOrderId, workOrderId),
      ),
    )
    .orderBy(asc(workOrderTasks.sequence));

  if (pasos.length === 0) return null;

  const hechos = pasos.filter((p) => p.result !== null).length;
  const noConformes = pasos.filter((p) => p.result === "no_conforme").length;

  return (
    <Panel
      title="Pauta de la rutina"
      hint={`${hechos} de ${pasos.length} pasos${
        noConformes > 0 ? ` · ${noConformes} no conforme${noConformes > 1 ? "s" : ""}` : ""
      }`}
    >
      <ol className="divide-y divide-ink-800">
        {pasos.map((p) => {
          const tipo = TIPOS[p.kind] ?? TIPOS.verificacion;
          const resultado = p.result ? RESULTADOS[p.result] : null;

          return (
            <li key={p.id} className="flex gap-3 px-5 py-3">
              <span className="num mt-0.5 w-5 shrink-0 text-[11px] text-ink-600">
                {p.sequence}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tipo.cls}`}
                  >
                    {tipo.texto}
                  </span>
                  <span className="text-xs leading-relaxed text-ink-200">
                    {p.description}
                  </span>
                </div>

                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  {resultado ? (
                    <span className={`text-[11px] font-medium ${resultado.cls}`}>
                      {resultado.texto}
                    </span>
                  ) : (
                    <span className="text-[11px] text-ink-600">Pendiente</span>
                  )}

                  {p.value !== null && (
                    <span className="num text-[11px] text-ink-300">
                      {Number(p.value)} {p.unit ?? ""}
                    </span>
                  )}

                  {p.completedBy && (
                    <span className="text-[11px] text-ink-500">{p.completedBy}</span>
                  )}
                </div>

                {p.notes && (
                  <p className="mt-1 text-[11px] leading-relaxed text-ink-400">
                    {p.notes}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
