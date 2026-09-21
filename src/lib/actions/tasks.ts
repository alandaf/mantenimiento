"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { workOrderTasks } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { getActiveOrgId } from "@/lib/org";
import { requireRole } from "@/lib/session";
import type { ActionState } from "@/lib/validation";

/**
 * Ejecución de la pauta: marcar cada paso a medida que se hace.
 *
 * Es la mitad que convierte la pauta en herramienta. Sin esto el sistema
 * muestra qué hay que hacer pero no recoge qué se hizo, y al cerrar la orden
 * lo único que queda es que alguien la cerró.
 */

type Resultado = "conforme" | "no_conforme" | "no_aplica";

const RESULTADOS: ReadonlySet<string> = new Set([
  "conforme",
  "no_conforme",
  "no_aplica",
]);

/** Estados en los que la pauta ya no se toca. */
const CERRADOS: ReadonlySet<string> = new Set(["cerrada", "anulada"]);

export async function updateTaskResult(
  taskId: number,
  resultado: string | null,
  valor?: string | null,
  notas?: string | null,
): Promise<ActionState> {
  const session = await requireRole("tecnico");
  const orgId = await getActiveOrgId();

  if (resultado !== null && !RESULTADOS.has(resultado)) {
    return { ok: false, message: "Resultado no válido." };
  }

  // Se comprueba el estado de la orden, no solo el del paso: una orden cerrada
  // o aprobada es un registro de lo que pasó, y editar su pauta después
  // reescribiría el histórico sin que nadie lo note.
  const [fila] = (await db.execute(sql`
    SELECT t.id, t.description, t.kind::text AS kind, t.result::text AS result,
           w.id AS work_order_id, w.status::text AS status, w.approved_by
    FROM work_order_tasks t
    JOIN work_orders w ON w.id = t.work_order_id
    WHERE t.id = ${taskId} AND t.organization_id = ${orgId}
  `)) as unknown as Array<{
    id: number;
    description: string;
    kind: string;
    result: string | null;
    work_order_id: number;
    status: string;
    approved_by: string | null;
  }>;

  if (!fila) return { ok: false, message: "Ese paso no existe." };

  if (CERRADOS.has(fila.status)) {
    return {
      ok: false,
      message:
        "La orden está cerrada. Para corregir la pauta hay que reabrirla, y eso queda registrado.",
    };
  }
  if (fila.approved_by) {
    return {
      ok: false,
      message: "El trabajo ya fue aprobado: la pauta no se modifica después.",
    };
  }

  // Un valor sin número no es una medición: es texto en un campo numérico.
  let numero: string | null = null;
  if (valor !== undefined && valor !== null && valor.trim() !== "") {
    const n = Number(valor.replace(",", "."));
    if (!Number.isFinite(n)) {
      return { ok: false, message: "El valor medido debe ser un número." };
    }
    numero = n.toFixed(4);
  }

  await db
    .update(workOrderTasks)
    .set({
      result: resultado as Resultado | null,
      value: numero,
      notes: notas?.trim() || null,
      completedAt: resultado ? new Date() : null,
      completedBy: resultado ? session.user.name : null,
    })
    .where(
      and(
        eq(workOrderTasks.id, taskId),
        eq(workOrderTasks.organizationId, orgId),
      ),
    );

  // Solo se audita el no conforme. Registrar cada casilla marcada llenaría el
  // historial de ruido y escondería lo que importa: el hallazgo que puede
  // terminar en una correctiva.
  if (resultado === "no_conforme") {
    await registrarAuditoria({
      entidad: "orden_trabajo",
      entidadId: fila.work_order_id,
      accion: "modificar",
      cambios: {
        [`Paso ${fila.description.slice(0, 60)}`]: {
          antes: fila.result ?? "pendiente",
          despues: "no conforme",
        },
      },
    });
  }

  revalidatePath(`/ordenes/${fila.work_order_id}`);
  return { ok: true };
}
