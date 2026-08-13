import { and, desc, eq, lte } from "drizzle-orm";
import { db } from "@/db";
import { meterReadings, pmPlans, workOrders } from "@/db/schema";
import { advancePlan } from "@/lib/kpi/meters";

/**
 * Acepta tanto la conexión normal como una transacción: el avance del plan debe
 * poder ejecutarse dentro de la misma transacción que cierra la orden.
 */
type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Avanza la cadencia del plan preventivo que originó una orden, al cerrarla.
 *
 * Sin esto una rutina queda vencida para siempre y el tablero miente desde el
 * primer cierre. Se ejecuta dentro de la misma transacción que el cierre para
 * que no puedan quedar desincronizados.
 *
 * Devuelve `true` si avanzó algún plan.
 */
export async function advancePlanForWorkOrder(
  tx: DbOrTx,
  workOrderId: number,
): Promise<boolean> {
  const [order] = await tx
    .select({
      pmPlanId: workOrders.pmPlanId,
      assetId: workOrders.assetId,
      finishedAt: workOrders.finishedAt,
    })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId))
    .limit(1);

  if (!order?.pmPlanId || !order.finishedAt) return false;

  const [plan] = await tx
    .select()
    .from(pmPlans)
    .where(eq(pmPlans.id, order.pmPlanId))
    .limit(1);

  if (!plan || !plan.active) return false;

  // Horómetro al momento del cierre, no el de hoy: si la OT se registra con
  // retraso, avanzar sobre la lectura actual regalaría horas de la cadencia.
  const [reading] = await tx
    .select({ hours: meterReadings.hours })
    .from(meterReadings)
    .where(
      and(
        eq(meterReadings.assetId, order.assetId),
        lte(meterReadings.takenAt, order.finishedAt),
      ),
    )
    .orderBy(desc(meterReadings.takenAt))
    .limit(1);

  const executedHours = reading ? Number(reading.hours) : null;

  const next = advancePlan(
    {
      trigger: plan.trigger,
      frequencyDays: plan.frequencyDays,
      frequencyHours: plan.frequencyHours,
    },
    order.finishedAt,
    executedHours,
  );

  await tx
    .update(pmPlans)
    .set({
      lastExecutedAt: order.finishedAt,
      lastExecutedHours: executedHours !== null ? executedHours.toFixed(1) : null,
      nextDueAt: next.nextDueAt,
      nextDueHours:
        next.nextDueHours !== null ? next.nextDueHours.toFixed(1) : null,
    })
    .where(eq(pmPlans.id, plan.id));

  return true;
}
