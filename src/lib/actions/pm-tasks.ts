"use server";

import { and, asc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { pmPlans, pmTasks } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { getActiveOrgId } from "@/lib/org";
import { requireRole } from "@/lib/session";
import type { ActionState } from "@/lib/validation";

/**
 * Edición de la pauta de una rutina preventiva.
 *
 * Solo toca la plantilla (`pm_tasks`). Las órdenes ya generadas conservan su
 * copia: cambiar hoy la pauta no reescribe lo que se pidió hacer ayer. Por eso
 * editarla es seguro y no necesita versiones.
 *
 * Cada cambio queda en la auditoría del plan: si una rutina deja de pedir una
 * medición y luego el equipo falla, tiene que poder saberse quién la quitó.
 */

const pasoSchema = z.object({
  description: z.string().trim().min(5, "Describe el paso").max(300),
  kind: z.enum(["verificacion", "medicion", "reemplazo", "intervencion", "registro"]),
  expectedUnit: z
    .string()
    .trim()
    .max(24)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  safetyNote: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null),
});

const TIPOS: Record<string, string> = {
  verificacion: "verificar",
  medicion: "medir",
  reemplazo: "reemplazar",
  intervencion: "intervenir",
  registro: "registrar",
};

function leer(formData: FormData) {
  return pasoSchema.safeParse({
    description: formData.get("description") ?? "",
    kind: formData.get("kind") ?? "verificacion",
    expectedUnit: formData.get("expectedUnit"),
    safetyNote: formData.get("safetyNote"),
  });
}

function errorDe(e: z.ZodError): ActionState {
  const primero = e.issues[0];
  return { ok: false, message: primero?.message ?? "Datos no válidos." };
}

async function planDeLaOrg(planId: number, orgId: string) {
  const [plan] = await db
    .select({ id: pmPlans.id })
    .from(pmPlans)
    .where(and(eq(pmPlans.id, planId), eq(pmPlans.organizationId, orgId)))
    .limit(1);
  return plan ?? null;
}

async function pasoDeLaOrg(taskId: number, orgId: string) {
  const [paso] = await db
    .select()
    .from(pmTasks)
    .where(and(eq(pmTasks.id, taskId), eq(pmTasks.organizationId, orgId)))
    .limit(1);
  return paso ?? null;
}

function resumen(p: { description: string; kind: string; expectedUnit: string | null }) {
  const unidad = p.kind === "medicion" && p.expectedUnit ? ` [${p.expectedUnit}]` : "";
  return `(${TIPOS[p.kind] ?? p.kind}) ${p.description}${unidad}`;
}

export async function addPmTask(
  planId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("planificador");
  const orgId = await getActiveOrgId();
  if (!(await planDeLaOrg(planId, orgId))) return { ok: false, message: "Ese plan no existe." };

  const r = leer(formData);
  if (!r.success) return errorDe(r.error);

  const [{ max }] = (await db.execute(sql`
    SELECT COALESCE(MAX(sequence), 0)::int AS max
    FROM pm_tasks WHERE pm_plan_id = ${planId} AND organization_id = ${orgId}
  `)) as unknown as Array<{ max: number }>;

  const secuencia = max + 1;
  await db.insert(pmTasks).values({
    organizationId: orgId,
    pmPlanId: planId,
    sequence: secuencia,
    description: r.data.description,
    kind: r.data.kind,
    expectedUnit: r.data.kind === "medicion" ? r.data.expectedUnit : null,
    safetyNote: r.data.safetyNote,
  });

  await registrarAuditoria({
    entidad: "plan_preventivo",
    entidadId: planId,
    accion: "modificar",
    cambios: {
      [`Paso ${secuencia} agregado`]: { antes: null, despues: resumen(r.data) },
    },
  });

  revalidatePath(`/preventivo/${planId}`);
  return { ok: true, message: "Paso agregado." };
}

export async function updatePmTask(
  taskId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("planificador");
  const orgId = await getActiveOrgId();
  const paso = await pasoDeLaOrg(taskId, orgId);
  if (!paso) return { ok: false, message: "Ese paso no existe." };

  const r = leer(formData);
  if (!r.success) return errorDe(r.error);

  const nuevo = {
    description: r.data.description,
    kind: r.data.kind,
    expectedUnit: r.data.kind === "medicion" ? r.data.expectedUnit : null,
    safetyNote: r.data.safetyNote,
  };

  const antes = resumen(paso);
  const despues = resumen(nuevo);
  const cambioSeguridad = (paso.safetyNote ?? null) !== nuevo.safetyNote;
  if (antes === despues && !cambioSeguridad) return { ok: true, message: "Sin cambios." };

  await db
    .update(pmTasks)
    .set(nuevo)
    .where(and(eq(pmTasks.id, taskId), eq(pmTasks.organizationId, orgId)));

  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
  if (antes !== despues) cambios[`Paso ${paso.sequence}`] = { antes, despues };
  if (cambioSeguridad) {
    cambios[`Advertencia paso ${paso.sequence}`] = {
      antes: paso.safetyNote,
      despues: nuevo.safetyNote,
    };
  }
  await registrarAuditoria({
    entidad: "plan_preventivo",
    entidadId: paso.pmPlanId,
    accion: "modificar",
    cambios,
  });

  revalidatePath(`/preventivo/${paso.pmPlanId}`);
  return { ok: true, message: "Paso actualizado." };
}

export async function deletePmTask(taskId: number): Promise<ActionState> {
  await requireRole("planificador");
  const orgId = await getActiveOrgId();
  const paso = await pasoDeLaOrg(taskId, orgId);
  if (!paso) return { ok: false, message: "Ese paso no existe." };

  // Las órdenes que ya lo copiaron quedan intactas: la FK es `set null`.
  await db
    .delete(pmTasks)
    .where(and(eq(pmTasks.id, taskId), eq(pmTasks.organizationId, orgId)));
  await renumerar(paso.pmPlanId, orgId);

  await registrarAuditoria({
    entidad: "plan_preventivo",
    entidadId: paso.pmPlanId,
    accion: "modificar",
    cambios: {
      [`Paso ${paso.sequence} eliminado`]: { antes: resumen(paso), despues: null },
    },
  });

  revalidatePath(`/preventivo/${paso.pmPlanId}`);
  return { ok: true };
}

export async function movePmTask(taskId: number, direccion: "arriba" | "abajo"): Promise<ActionState> {
  await requireRole("planificador");
  const orgId = await getActiveOrgId();
  const paso = await pasoDeLaOrg(taskId, orgId);
  if (!paso) return { ok: false, message: "Ese paso no existe." };

  const pasos = await ordenados(paso.pmPlanId, orgId);
  const i = pasos.findIndex((p) => p.id === taskId);
  const j = direccion === "arriba" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= pasos.length) return { ok: true };

  [pasos[i], pasos[j]] = [pasos[j], pasos[i]];
  await db.transaction(async (tx) => {
    for (const [k, p] of pasos.entries()) {
      await tx
        .update(pmTasks)
        .set({ sequence: k + 1 })
        .where(and(eq(pmTasks.id, p.id), eq(pmTasks.organizationId, orgId)));
    }
  });

  await registrarAuditoria({
    entidad: "plan_preventivo",
    entidadId: paso.pmPlanId,
    accion: "modificar",
    cambios: {
      [`Orden del paso "${paso.description.slice(0, 50)}"`]: { antes: i + 1, despues: j + 1 },
    },
  });

  revalidatePath(`/preventivo/${paso.pmPlanId}`);
  return { ok: true };
}

async function ordenados(planId: number, orgId: string) {
  return db
    .select({ id: pmTasks.id })
    .from(pmTasks)
    .where(and(eq(pmTasks.pmPlanId, planId), eq(pmTasks.organizationId, orgId)))
    .orderBy(asc(pmTasks.sequence), asc(pmTasks.id));
}

async function renumerar(planId: number, orgId: string) {
  const pasos = await ordenados(planId, orgId);
  await db.transaction(async (tx) => {
    for (const [k, p] of pasos.entries()) {
      await tx
        .update(pmTasks)
        .set({ sequence: k + 1 })
        .where(and(eq(pmTasks.id, p.id), eq(pmTasks.organizationId, orgId)));
    }
  });
}
