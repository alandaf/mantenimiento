"use server";

import { and, desc, eq, gt, lt, sql } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
import { meterReadings } from "@/db/schema";
import type { ActionState } from "@/lib/validation";

const readingSchema = z.object({
  assetId: z.coerce.number().int().positive(),
  hours: z.coerce
    .number({ invalid_type_error: "La lectura debe ser un número" })
    .min(0, "Un horómetro no puede ser negativo")
    .max(500_000, "Lectura fuera de rango"),
  takenAt: z
    .string()
    .trim()
    .min(1, "La fecha de la lectura es obligatoria")
    .transform((v) => new Date(v))
    .refine((d) => !Number.isNaN(d.getTime()), "Fecha inválida"),
  note: z
    .string()
    .trim()
    .max(300)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
});

/**
 * Registra una lectura de horómetro.
 *
 * Las dos validaciones importantes no son de formato sino de física: un
 * horómetro no retrocede, y no puede avanzar más horas de las que tiene el
 * calendario. Un dedo gordo aquí desplaza el vencimiento de una rutina meses.
 */
export async function addMeterReading(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("tecnico");
  const parsed = readingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { assetId, hours, takenAt, note } = parsed.data;

  if (takenAt.getTime() > Date.now() + 86_400_000) {
    return {
      ok: false,
      message: "La lectura no puede ser de una fecha futura.",
      errors: { takenAt: ["Fecha futura"] },
    };
  }

  // Lectura inmediatamente anterior: el horómetro no puede haber retrocedido.
  const [previous] = await db
    .select()
    .from(meterReadings)
    .where(and(eq(meterReadings.assetId, assetId), lt(meterReadings.takenAt, takenAt)))
    .orderBy(desc(meterReadings.takenAt))
    .limit(1);

  if (previous) {
    const prevHours = Number(previous.hours);
    if (hours < prevHours) {
      return {
        ok: false,
        message: `La lectura anterior (${prevHours.toLocaleString()} h) es mayor. Un horómetro no retrocede: si se reemplazó el instrumento, anótalo en la nota y corrige el histórico.`,
        errors: { hours: ["Menor que la lectura anterior"] },
      };
    }

    const elapsedDays =
      (takenAt.getTime() - previous.takenAt.getTime()) / 86_400_000;
    const maxPossible = Math.max(1, elapsedDays) * 24;
    if (hours - prevHours > maxPossible) {
      return {
        ok: false,
        message: `Imposible: ${Math.round(hours - prevHours)} h de marcha en ${elapsedDays.toFixed(1)} días. Revisa si sobra un dígito.`,
        errors: { hours: ["Salto imposible respecto a la lectura anterior"] },
      };
    }
  }

  // Lectura posterior: la nueva no puede superarla si se está intercalando.
  const [following] = await db
    .select()
    .from(meterReadings)
    .where(and(eq(meterReadings.assetId, assetId), gt(meterReadings.takenAt, takenAt)))
    .orderBy(meterReadings.takenAt)
    .limit(1);

  if (following && hours > Number(following.hours)) {
    return {
      ok: false,
      message: `Hay una lectura posterior menor (${Number(following.hours).toLocaleString()} h). Intercalar esta rompería la serie.`,
      errors: { hours: ["Mayor que una lectura posterior"] },
    };
  }

  try {
    await db.insert(meterReadings).values({
      organizationId: await getActiveOrgId(),
      assetId,
      hours: hours.toFixed(1),
      takenAt,
      source: "manual",
      note,
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (raw.includes("meter_asset_moment_uq")) {
      return {
        ok: false,
        message: "Ya existe una lectura de este activo en ese mismo instante.",
      };
    }
    return { ok: false, message: "No se pudo registrar la lectura." };
  }

  revalidatePath("/horometros");
  revalidatePath("/preventivo");
  return { ok: true, message: "Lectura registrada." };
}

/** Elimina una lectura — para corregir un tecleo sin perder la serie. */
export async function deleteMeterReading(id: number): Promise<ActionState> {
  await requireRole("tecnico");
  await db
    .delete(meterReadings)
    .where(and(eq(meterReadings.id, id), eq(meterReadings.organizationId, await getActiveOrgId())));
  revalidatePath("/horometros");
  revalidatePath("/preventivo");
  return { ok: true, message: "Lectura eliminada." };
}

/** Activos con horómetro, para el selector del formulario. */
export async function getMeterAssets() {
  return (await db.execute(sql`
    SELECT id, tag, name FROM assets
    WHERE organization_id = ${await getActiveOrgId()} AND tracks_hours = true AND status <> 'baja'
    ORDER BY tag
  `)) as unknown as Array<{ id: number; tag: string; name: string }>;
}
