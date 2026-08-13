"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { workOrders } from "@/db/schema";
import { advancePlanForWorkOrder } from "./advance-plan";
import {
  toActionState,
  workOrderSchema,
  type ActionState,
  type WorkOrderInput,
} from "@/lib/validation";

/** Los campos numeric de Postgres viajan como string en drizzle. */
function toRow(data: WorkOrderInput) {
  return {
    ...data,
    estimatedHours: data.estimatedHours.toFixed(2),
    laborHours: data.laborHours.toFixed(2),
    laborCost: data.laborCost.toFixed(2),
    partsCost: data.partsCost.toFixed(2),
  };
}

/** Correlativo OT-AAAA-NNNN por año, calculado en la BD para evitar colisiones. */
async function nextCode(): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = (await db.execute(sql`
    SELECT COALESCE(MAX(SUBSTRING(code FROM 9)::int), 0) + 1 AS next
    FROM work_orders
    WHERE code LIKE ${`OT-${year}-%`}
  `)) as unknown as Array<{ next: number }>;
  return `OT-${year}-${String(row.next).padStart(4, "0")}`;
}

export async function createWorkOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = workOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionState(parsed.error);

  let code: string;
  try {
    code = await nextCode();
    await db.insert(workOrders).values({ ...toRow(parsed.data), code });
  } catch {
    return { ok: false, message: "No se pudo crear la orden de trabajo." };
  }

  revalidatePath("/ordenes");
  revalidatePath("/dashboard");
  redirect("/ordenes");
}

export async function updateWorkOrder(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = workOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionState(parsed.error);

  try {
    await db.transaction(async (tx) => {
      await tx.update(workOrders).set(toRow(parsed.data)).where(eq(workOrders.id, id));
      if (parsed.data.status === "cerrada") {
        await advancePlanForWorkOrder(tx, id);
      }
    });
  } catch {
    return { ok: false, message: "No se pudo actualizar la orden de trabajo." };
  }

  revalidatePath("/ordenes");
  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/dashboard");
  revalidatePath("/preventivo");
  redirect("/ordenes");
}

/**
 * Cierre rápido desde el listado. Si la OT nunca se inició se toma la fecha de
 * reporte como inicio, para no generar un MTTR imposible de calcular.
 */
export async function closeWorkOrder(id: number): Promise<ActionState> {
  let advanced = false;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE work_orders
        SET status = 'cerrada',
            started_at = COALESCE(started_at, reported_at),
            finished_at = COALESCE(finished_at, now())
        WHERE id = ${id} AND status NOT IN ('cerrada', 'anulada')
      `);
      advanced = await advancePlanForWorkOrder(tx, id);
    });
  } catch {
    return { ok: false, message: "No se pudo cerrar la orden." };
  }

  revalidatePath("/ordenes");
  revalidatePath("/dashboard");
  revalidatePath("/preventivo");
  return {
    ok: true,
    message: advanced
      ? "Orden cerrada y plan preventivo reprogramado."
      : "Orden cerrada.",
  };
}

export async function deleteWorkOrder(id: number): Promise<ActionState> {
  await db.delete(workOrders).where(eq(workOrders.id, id));
  revalidatePath("/ordenes");
  revalidatePath("/dashboard");
  return { ok: true, message: "Orden eliminada." };
}
