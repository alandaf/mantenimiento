import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pmTasks, workOrderTasks } from "@/db/schema";
import { Panel } from "@/components/ui";
import { getActiveOrgId } from "@/lib/org";
import { TaskRow } from "./task-row";

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

export async function TaskChecklist({
  workOrderId,
  editable = false,
}: {
  workOrderId: number;
  /** La pauta se ejecuta mientras la orden sigue abierta. */
  editable?: boolean;
}) {
  const orgId = await getActiveOrgId();
  const pasos = await db
    .select({
      id: workOrderTasks.id,
      sequence: workOrderTasks.sequence,
      description: workOrderTasks.description,
      kind: workOrderTasks.kind,
      result: workOrderTasks.result,
      value: workOrderTasks.value,
      unit: workOrderTasks.unit,
      notes: workOrderTasks.notes,
      completedBy: workOrderTasks.completedBy,
      // La advertencia vive en la plantilla: es propia del paso, no de una
      // ejecución concreta.
      safetyNote: pmTasks.safetyNote,
    })
    .from(workOrderTasks)
    .leftJoin(pmTasks, eq(pmTasks.id, workOrderTasks.pmTaskId))
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
        {pasos.map((p) => (
          <TaskRow
            key={p.id}
            id={p.id}
            sequence={p.sequence}
            description={p.description}
            kind={p.kind}
            result={p.result}
            value={p.value}
            unit={p.unit}
            notes={p.notes}
            completedBy={p.completedBy}
            safetyNote={p.safetyNote}
            editable={editable}
          />
        ))}
      </ol>
    </Panel>
  );
}
