"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { SUPPORTED_CURRENCIES, SUPPORTED_LOCALES } from "@/lib/config";
import { getActiveOrgId } from "@/lib/org";
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

  await db
    .insert(settings)
    .values({ organizationId: await getActiveOrgId(), ...parsed.data })
    .onConflictDoUpdate({
      target: settings.organizationId,
      set: parsed.data,
    });

  // La moneda alcanza a todas las pantallas y al PDF: se revalida la
  // aplicación entera, no solo esta página.
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: "Configuración guardada. Los montos ya usan la nueva moneda.",
  };
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
