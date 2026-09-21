"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { measurements, workOrderMaterials, workOrders } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { getActiveOrgId } from "@/lib/org";
import { requireRole } from "@/lib/session";
import type { ActionState } from "@/lib/validation";

/**
 * Mediciones y materiales de una orden.
 *
 * Solo se agregan, no se editan ni se borran: una lectura anotada es un hecho,
 * y si estaba mal se agrega la correcta con una observación. Es el mismo
 * criterio que un libro de máquinas: no se borra, se enmienda.
 */

const numero = (msg: string) =>
  z
    .string()
    .trim()
    .min(1, msg)
    .transform((v) => Number(v.replace(",", ".")))
    .refine((n) => Number.isFinite(n), msg);

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

const medicionSchema = z.object({
  variable: z.string().trim().min(2, "Indica qué se midió").max(80),
  moment: z.enum(["antes", "despues"]),
  value: numero("El valor medido debe ser un número"),
  unit: z.string().trim().min(1, "Indica la unidad").max(24),
  threshold: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : null))
    .refine((n) => n === null || Number.isFinite(n), "El límite debe ser un número"),
  notes: textoOpcional(500),
});

const materialSchema = z.object({
  description: z.string().trim().min(3, "Describe el material").max(200),
  quantity: numero("La cantidad debe ser un número").refine((n) => n > 0, "La cantidad debe ser mayor que cero"),
  unit: textoOpcional(24),
  unitCost: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? Number(v.replace(",", ".")) : 0))
    .refine((n) => Number.isFinite(n) && n >= 0, "El costo unitario no es válido"),
  partNumber: textoOpcional(80),
});

/** La orden debe existir, ser de la instalación y seguir abierta. */
async function ordenAbierta(workOrderId: number, orgId: string): Promise<string | null> {
  const [o] = await db
    .select({ status: workOrders.status, approvedBy: workOrders.approvedBy })
    .from(workOrders)
    .where(and(eq(workOrders.id, workOrderId), eq(workOrders.organizationId, orgId)))
    .limit(1);
  if (!o) return "Esa orden no existe.";
  if (o.status === "cerrada" || o.status === "anulada") {
    return "La orden está cerrada: para agregar registros hay que reabrirla, y eso queda registrado.";
  }
  if (o.approvedBy) return "El trabajo ya fue aprobado: no se agregan registros después.";
  return null;
}

function primerError(e: z.ZodError): ActionState {
  return { ok: false, message: e.issues[0]?.message ?? "Datos no válidos." };
}

export async function addMeasurement(
  workOrderId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("tecnico");
  const orgId = await getActiveOrgId();

  const r = medicionSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return primerError(r.error);

  const bloqueo = await ordenAbierta(workOrderId, orgId);
  if (bloqueo) return { ok: false, message: bloqueo };

  await db.insert(measurements).values({
    organizationId: orgId,
    workOrderId,
    moment: r.data.moment,
    variable: r.data.variable,
    value: r.data.value.toFixed(4),
    unit: r.data.unit,
    threshold: r.data.threshold === null ? null : r.data.threshold.toFixed(4),
    notes: r.data.notes,
  });

  await registrarAuditoria({
    entidad: "orden_trabajo",
    entidadId: workOrderId,
    accion: "modificar",
    cambios: {
      [`Medición ${r.data.moment} · ${r.data.variable}`]: {
        antes: null,
        despues: `${r.data.value} ${r.data.unit}`,
      },
    },
  });

  revalidatePath(`/ordenes/${workOrderId}`);
  return { ok: true, message: "Medición registrada." };
}

export async function addMaterial(
  workOrderId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("tecnico");
  const orgId = await getActiveOrgId();

  const r = materialSchema.safeParse(Object.fromEntries(formData));
  if (!r.success) return primerError(r.error);

  const bloqueo = await ordenAbierta(workOrderId, orgId);
  if (bloqueo) return { ok: false, message: bloqueo };

  const subtotal = r.data.quantity * r.data.unitCost;

  // El costo de repuestos de la orden se mantiene como suma del detalle: si
  // no, el indicador de costo y la lista de materiales cuentan historias
  // distintas.
  const [{ antes }] = (await db.execute(sql`
    SELECT parts_cost::numeric AS antes FROM work_orders
    WHERE id = ${workOrderId} AND organization_id = ${orgId}
  `)) as unknown as Array<{ antes: string }>;

  await db.transaction(async (tx) => {
    await tx.insert(workOrderMaterials).values({
      organizationId: orgId,
      workOrderId,
      description: r.data.description,
      quantity: r.data.quantity.toFixed(3),
      unit: r.data.unit,
      unitCost: r.data.unitCost.toFixed(2),
      partNumber: r.data.partNumber,
    });
    await tx.execute(sql`
      UPDATE work_orders SET parts_cost = parts_cost + ${subtotal.toFixed(2)}::numeric
      WHERE id = ${workOrderId} AND organization_id = ${orgId}
    `);
  });

  await registrarAuditoria({
    entidad: "orden_trabajo",
    entidadId: workOrderId,
    accion: "modificar",
    cambios: {
      [`Material · ${r.data.description}`]: {
        antes: null,
        despues: `${r.data.quantity} ${r.data.unit ?? "u"}`,
      },
      partsCost: { antes: Number(antes), despues: Number(antes) + subtotal },
    },
  });

  revalidatePath(`/ordenes/${workOrderId}`);
  return { ok: true, message: "Material agregado." };
}
