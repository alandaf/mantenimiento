"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { workOrders } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { getActiveOrgId } from "@/lib/org";
import { puedeAprobar } from "@/lib/kpi/approval";
import { requireRole } from "@/lib/session";
import type { ActionState } from "@/lib/validation";

/**
 * Aprobación de trabajos.
 *
 * Una orden cerrada dice que el trabajo se hizo. La aprobación dice que
 * alguien distinto lo revisó y está conforme. En equipos críticos esa
 * diferencia es la única barrera contra el error honesto: quien hizo la
 * reparación es la persona con menos distancia para juzgar si quedó bien.
 */

type OrdenParaAprobar = {
  id: number;
  status: string;
  approved_by: string | null;
  assigned_user_id: string | null;
  criticality: string;
  is_safety_system: boolean;
  asset_tag: string;
};

async function cargar(id: number): Promise<OrdenParaAprobar | null> {
  const orgId = await getActiveOrgId();
  const [fila] = (await db.execute(sql`
    SELECT
      wo.id,
      wo.status::text AS status,
      wo.approved_by,
      t.email AS assigned_user_id,
      a.criticality::text AS criticality,
      a.is_safety_system,
      a.tag AS asset_tag
    FROM work_orders wo
    JOIN assets a ON a.id = wo.asset_id
    LEFT JOIN technicians t ON t.id = wo.assigned_to
    WHERE wo.id = ${id} AND wo.organization_id = ${orgId}
  `)) as unknown as OrdenParaAprobar[];
  return fila ?? null;
}

export async function approveWorkOrder(
  id: number,
  comentario?: string,
): Promise<ActionState> {
  // Aprobar no es ejecutar: se pide un rol de supervisión.
  const session = await requireRole("jefe");

  const orden = await cargar(id);
  if (!orden) return { ok: false, message: "Esa orden no existe." };

  // La decisión vive en una función pura y probada: aquí solo se traduce.
  const veredicto = puedeAprobar({
    estado: orden.status,
    yaAprobada: Boolean(orden.approved_by),
    criticidad: orden.criticality,
    esSistemaDeSeguridad: orden.is_safety_system,
    correoEjecutor: orden.assigned_user_id,
    correoAprobador: session.user.email,
  });

  if (!veredicto.puede) {
    return { ok: false, message: veredicto.motivo };
  }

  const orgId = await getActiveOrgId();
  await db
    .update(workOrders)
    .set({ approvedBy: session.user.id, approvedAt: new Date() })
    .where(and(eq(workOrders.id, id), eq(workOrders.organizationId, orgId)));

  await registrarAuditoria({
    entidad: "orden_trabajo",
    entidadId: id,
    accion: "aprobar",
    motivo: comentario?.trim() || null,
  });

  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/ordenes");
  return { ok: true, message: "Trabajo aprobado." };
}

export async function rejectWorkOrder(
  id: number,
  motivo: string,
): Promise<ActionState> {
  const session = await requireRole("jefe");

  // El motivo no es opcional: rechazar sin decir por qué devuelve el trabajo a
  // quien lo hizo sin información para corregirlo.
  if (!motivo?.trim()) {
    return { ok: false, message: "Indica por qué se rechaza el trabajo." };
  }

  const orden = await cargar(id);
  if (!orden) return { ok: false, message: "Esa orden no existe." };
  if (orden.status !== "cerrada") {
    return { ok: false, message: "Solo se rechaza una orden cerrada." };
  }

  const orgId = await getActiveOrgId();
  await db
    .update(workOrders)
    .set({ status: "ejecucion", approvedBy: null, approvedAt: null })
    .where(and(eq(workOrders.id, id), eq(workOrders.organizationId, orgId)));

  await registrarAuditoria({
    entidad: "orden_trabajo",
    entidadId: id,
    accion: "rechazar",
    cambios: { status: { antes: "cerrada", despues: "ejecucion" } },
    motivo,
  });

  revalidatePath(`/ordenes/${id}`);
  revalidatePath("/ordenes");
  return {
    ok: true,
    message: `Trabajo rechazado y devuelto a ejecución. Revisó ${session.user.name}.`,
  };
}
