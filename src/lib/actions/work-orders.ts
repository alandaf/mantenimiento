"use server";

import { and, asc, eq, notInArray, sql } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { diferencias, registrarAuditoria } from "@/lib/audit";
import { puedeCerrarse } from "@/lib/kpi/closure";
import { assets, pmPlans, pmTasks, workOrderTasks } from "@/db/schema";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
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

/**
 * Comprueba que la pauta esté resuelta antes de cerrar.
 *
 * No se cierra una orden con pasos en blanco: cada paso tiene que quedar con
 * el nombre de quien lo asumió. Resuelto no es conforme —no conforme y no
 * aplica también cierran—; lo que no se admite es el blanco.
 */
async function verificarPauta(id: number, orgId: string) {
  const pasos = await db
    .select({
      sequence: workOrderTasks.sequence,
      description: workOrderTasks.description,
      result: workOrderTasks.result,
    })
    .from(workOrderTasks)
    .where(
      and(
        eq(workOrderTasks.workOrderId, id),
        eq(workOrderTasks.organizationId, orgId),
      ),
    );
  return puedeCerrarse(pasos);
}

/** Correlativo OT-AAAA-NNNN por año, calculado en la BD para evitar colisiones. */
async function nextCode(orgId: string): Promise<string> {
  const year = new Date().getFullYear();
  const [row] = (await db.execute(sql`
    SELECT COALESCE(MAX(SUBSTRING(code FROM 9)::int), 0) + 1 AS next
    FROM work_orders
    WHERE organization_id = ${orgId} AND code LIKE ${`OT-${year}-%`}
  `)) as unknown as Array<{ next: number }>;
  return `OT-${year}-${String(row.next).padStart(4, "0")}`;
}

/**
 * Emite la orden de una rutina preventiva, con su pauta.
 *
 * La pauta se copia en el momento: la orden conserva los pasos que se pidieron
 * ese día aunque la rutina cambie después. Si la rutina ya tiene una orden
 * viva, no se emite otra: dos órdenes para la misma mantención terminan con
 * una ejecutada y la otra olvidada, contando como pendiente para siempre.
 */
export async function generatePmWorkOrder(planId: number): Promise<ActionState> {
  await requireRole("planificador");
  const orgId = await getActiveOrgId();

  const [plan] = await db
    .select({
      id: pmPlans.id,
      name: pmPlans.name,
      assetId: pmPlans.assetId,
      estimatedHours: pmPlans.estimatedHours,
      active: pmPlans.active,
      tag: assets.tag,
      criticality: assets.criticality,
    })
    .from(pmPlans)
    .innerJoin(assets, eq(assets.id, pmPlans.assetId))
    .where(and(eq(pmPlans.id, planId), eq(pmPlans.organizationId, orgId)))
    .limit(1);
  if (!plan) return { ok: false, message: "Esa rutina no existe." };
  if (!plan.active) return { ok: false, message: "La rutina está inactiva." };

  const [viva] = await db
    .select({ id: workOrders.id, code: workOrders.code })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.organizationId, orgId),
        eq(workOrders.pmPlanId, planId),
        notInArray(workOrders.status, ["cerrada", "anulada"]),
      ),
    )
    .limit(1);
  if (viva) {
    return {
      ok: false,
      message: `Esta rutina ya tiene una orden abierta: ${viva.code}. Ciérrala o anúlala antes de emitir otra.`,
    };
  }

  const plantilla = await db
    .select()
    .from(pmTasks)
    .where(and(eq(pmTasks.pmPlanId, planId), eq(pmTasks.organizationId, orgId)))
    .orderBy(asc(pmTasks.sequence), asc(pmTasks.id));

  let creadaId: number;
  try {
    const code = await nextCode(orgId);
    creadaId = await db.transaction(async (tx) => {
      const [creada] = await tx
        .insert(workOrders)
        .values({
          organizationId: orgId,
          code,
          assetId: plan.assetId,
          pmPlanId: plan.id,
          type: "preventivo",
          status: "abierta",
          // Un preventivo de un equipo crítico no espera como uno de apoyo.
          priority: plan.criticality === "critica" ? 2 : 3,
          title: `${plan.name} · ${plan.tag}`,
          estimatedHours: plan.estimatedHours,
          reportedAt: new Date(),
        })
        .returning({ id: workOrders.id });

      if (plantilla.length > 0) {
        await tx.insert(workOrderTasks).values(
          plantilla.map((t) => ({
            organizationId: orgId,
            workOrderId: creada.id,
            pmTaskId: t.id,
            sequence: t.sequence,
            description: t.description,
            kind: t.kind,
            unit: t.expectedUnit,
          })),
        );
      }
      return creada.id;
    });
  } catch {
    return { ok: false, message: "No se pudo emitir la orden." };
  }

  await registrarAuditoria({
    entidad: "orden_trabajo",
    entidadId: creadaId,
    accion: "crear",
    cambios: { "Emitida desde la rutina": { antes: null, despues: plan.name } },
  });

  revalidatePath("/ordenes");
  revalidatePath(`/preventivo/${planId}`);
  redirect(`/ordenes/${creadaId}`);
}

export async function createWorkOrder(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("tecnico");
  const parsed = workOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionState(parsed.error);

  let code: string;
  try {
    const orgId = await getActiveOrgId();
    code = await nextCode(orgId);
    const [creada] = await db
      .insert(workOrders)
      .values({ ...toRow(parsed.data), code, organizationId: orgId })
      .returning({ id: workOrders.id });
    // Después del éxito, nunca antes: anotar una intención que luego falla
    // produce un histórico que miente.
    await registrarAuditoria({
      entidad: "orden_trabajo",
      entidadId: creada.id,
      accion: "crear",
    });
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
  await requireRole("tecnico");
  const parsed = workOrderSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return toActionState(parsed.error);
  const orgId = await getActiveOrgId();

  // Se lee el estado previo para registrar solo lo que cambió. Guardar el
  // registro entero antes y después hace el histórico ilegible.
  if (parsed.data.status === "cerrada") {
    const pauta = await verificarPauta(id, orgId);
    if (!pauta.puede) return { ok: false, message: pauta.mensaje };
  }

  const [previa] = await db
    .select()
    .from(workOrders)
    .where(and(eq(workOrders.id, id), eq(workOrders.organizationId, orgId)))
    .limit(1);

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(workOrders)
        .set(toRow(parsed.data))
        .where(and(eq(workOrders.id, id), eq(workOrders.organizationId, orgId)));
      if (parsed.data.status === "cerrada") {
        await advancePlanForWorkOrder(tx, id);
      }
    });
  } catch {
    return { ok: false, message: "No se pudo actualizar la orden de trabajo." };
  }

  if (previa) {
    const cambios = diferencias(previa, toRow(parsed.data) as Record<string, unknown>);
    if (cambios) {
      const cambioDeEstado = "status" in cambios;
      await registrarAuditoria({
        entidad: "orden_trabajo",
        entidadId: id,
        accion: cambioDeEstado
          ? parsed.data.status === "cerrada"
            ? "cerrar"
            : "cambiar_estado"
          : "modificar",
        cambios,
      });
    }
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
  await requireRole("tecnico");

  const orgId = await getActiveOrgId();
  const pauta = await verificarPauta(id, orgId);
  if (!pauta.puede) return { ok: false, message: pauta.mensaje };

  let advanced = false;
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE work_orders
        SET status = 'cerrada',
            started_at = COALESCE(started_at, reported_at),
            finished_at = COALESCE(finished_at, now())
        WHERE id = ${id} AND organization_id = ${await getActiveOrgId()}
          AND status NOT IN ('cerrada', 'anulada')
      `);
      advanced = await advancePlanForWorkOrder(tx, id);
    });
    await registrarAuditoria({
      entidad: "orden_trabajo",
      entidadId: id,
      accion: "cerrar",
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
  await requireRole("tecnico");
  await db
    .delete(workOrders)
    .where(and(eq(workOrders.id, id), eq(workOrders.organizationId, await getActiveOrgId())));
  revalidatePath("/ordenes");
  revalidatePath("/dashboard");
  return { ok: true, message: "Orden eliminada." };
}
