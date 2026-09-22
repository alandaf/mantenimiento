"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { SUPPORTED_CURRENCIES, SUPPORTED_LOCALES } from "@/lib/config";
import { getActiveOrgId } from "@/lib/org";
import { registrarAuditoria } from "@/lib/audit";
import { ROLES, type Role } from "@/lib/roles";
import { requireRole } from "@/lib/session";
import type { ActionState } from "@/lib/validation";

const schema = z.object({
  installationName: z
    .string()
    .trim()
    .min(2, "El nombre de la instalación es obligatorio")
    .max(160),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => SUPPORTED_CURRENCIES.includes(c), "Moneda no soportada"),
  locale: z
    .string()
    .trim()
    .refine((l) => SUPPORTED_LOCALES.includes(l), "Formato regional no soportado"),
  notes: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

export async function updateSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const orgId = await getActiveOrgId();

  await db
    .insert(settings)
    .values({ organizationId: orgId, ...parsed.data })
    .onConflictDoUpdate({
      target: settings.organizationId,
      set: parsed.data,
    });

  // El nombre está duplicado en `organization`, que es lo que ve la consola de
  // plataforma. Sin esto, renombrar el buque aquí dejaba a la consola mostrando
  // el nombre viejo indefinidamente.
  await db.execute(
    sql`UPDATE organization SET name = ${parsed.data.installationName} WHERE id = ${orgId}`,
  );

  // La moneda alcanza a todas las pantallas y al PDF: se revalida la
  // aplicación entera, no solo esta página.
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: "Configuración guardada. Los montos ya usan la nueva moneda.",
  };
}

/**
 * Nombres de los roles de la instalación.
 *
 * Solo cambia cómo se llaman. Los permisos van con la clave interna, que es
 * la misma en todas las instalaciones: renombrar «Técnico» a «Mecánico» no le
 * da ni le quita nada a nadie.
 */
export async function updateRoleLabels(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");
  const orgId = await getActiveOrgId();

  const nuevos: Record<string, string> = {};
  for (const clave of Object.keys(ROLES) as Role[]) {
    const v = String(formData.get(clave) ?? "").trim();
    if (v.length > 40) return { ok: false, message: `El nombre «${v.slice(0, 20)}…» supera los 40 caracteres.` };
    if (v && v !== ROLES[clave]) nuevos[clave] = v;
  }

  // Dos roles con el mismo nombre harían imposible saber, en la lista de
  // usuarios, quién aprueba y quién no.
  const finales = (Object.keys(ROLES) as Role[]).map((k) => (nuevos[k] ?? ROLES[k]).toLowerCase());
  if (new Set(finales).size !== finales.length) {
    return { ok: false, message: "Dos roles no pueden llamarse igual." };
  }

  const [antes] = await db
    .select({ roleLabels: settings.roleLabels })
    .from(settings)
    .where(eq(settings.organizationId, orgId))
    .limit(1);

  await db
    .insert(settings)
    .values({ organizationId: orgId, roleLabels: nuevos })
    .onConflictDoUpdate({ target: settings.organizationId, set: { roleLabels: nuevos } });

  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const k of Object.keys(ROLES) as Role[]) {
    const a = antes?.roleLabels?.[k] ?? ROLES[k];
    const d = nuevos[k] ?? ROLES[k];
    if (a !== d) cambios[`Nombre del rol ${ROLES[k]}`] = { antes: a, despues: d };
  }
  if (Object.keys(cambios).length > 0) {
    await registrarAuditoria({ entidad: "configuracion", entidadId: orgId, accion: "modificar", cambios });
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Nombres de los roles guardados." };
}

export async function readSettings() {
  await requireRole("admin");
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, await getActiveOrgId()))
    .limit(1);
  return row ?? null;
}
