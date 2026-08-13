"use server";

import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { auth } from "@/lib/auth";
import { SUPPORTED_CURRENCIES, SUPPORTED_LOCALES } from "@/lib/config";
import { requireSuperadmin } from "@/lib/platform";
import type { ActionState } from "@/lib/validation";

/**
 * Consola de plataforma: alta de instalaciones y de su primer administrador.
 *
 * Esto existe porque dar de alta un cliente era hasta ahora una tarea de
 * servidor —entrar por SSH y ejecutar un script—, lo que convertía una decisión
 * comercial en un cuello de botella técnico.
 *
 * Sigue **fuera** del alcance de los administradores de buque: crear una
 * instalación es una decisión comercial, y quien manda en una sala de máquinas
 * no debe poder autoprovisionarse flota.
 */

/** El slug es la identidad estable de la instalación: entra en índices y URLs. */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const installationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, "El nombre es obligatorio")
    .max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Mínimo 3 caracteres")
    .max(60)
    .refine(
      (s) => SLUG.test(s),
      "Solo minúsculas, números y guiones (ej: bahia-valparaiso)",
    ),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .refine((c) => SUPPORTED_CURRENCIES.includes(c), "Moneda no soportada"),
  locale: z
    .string()
    .trim()
    .refine((l) => SUPPORTED_LOCALES.includes(l), "Formato regional no soportado"),
});

export async function createInstallation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperadmin();

  const parsed = installationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { name, slug, currency, locale } = parsed.data;

  const [existing] = (await db.execute(
    sql`SELECT id FROM organization WHERE slug = ${slug} LIMIT 1`,
  )) as unknown as Array<{ id: string }>;

  if (existing) {
    return {
      ok: false,
      message: "Ya existe una instalación con ese identificador.",
      errors: { slug: ["Identificador en uso"] },
    };
  }

  const [org] = (await db.execute(sql`
    INSERT INTO organization (id, name, slug, created_at)
    VALUES (${crypto.randomUUID()}, ${name}, ${slug}, now())
    RETURNING id
  `)) as unknown as Array<{ id: string }>;

  // La configuración regional nace con la instalación: sin esta fila, la
  // primera pantalla que abra el cliente tendría que inventarse una moneda.
  await db.insert(settings).values({
    organizationId: org.id,
    installationName: name,
    currency,
    locale,
  });

  revalidatePath("/plataforma");
  return {
    ok: true,
    message: `${name} creada. Ahora asígnale un administrador.`,
  };
}

const adminSchema = z.object({
  organizationId: z.string().trim().min(1, "Elige una instalación"),
  name: z.string().trim().min(3, "El nombre es obligatorio").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z.string().min(10, "Mínimo 10 caracteres").max(100),
});

/**
 * Primer administrador de una instalación. Es el problema del arranque en frío
 * resuelto dentro del producto: no hay registro público, y solo un admin puede
 * crear cuentas, así que la primera de cada buque tiene que nacer desde fuera.
 */
export async function createInstallationAdmin(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSuperadmin();

  const parsed = adminSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { organizationId, name, email, password } = parsed.data;

  const [org] = (await db.execute(
    sql`SELECT name FROM organization WHERE id = ${organizationId} LIMIT 1`,
  )) as unknown as Array<{ name: string }>;

  if (!org) return { ok: false, message: "Esa instalación ya no existe." };

  try {
    const created = await auth.api.createUser({
      body: { name, email, password, role: "admin" },
      headers: await headers(),
    });

    await db.execute(sql`
      INSERT INTO member (id, organization_id, user_id, role, created_at)
      VALUES (${crypto.randomUUID()}, ${organizationId}, ${created.user.id}, 'owner', now())
    `);
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/exist|duplicate|unique/i.test(raw)) {
      return {
        ok: false,
        message: "Ya existe una cuenta con ese correo.",
        errors: { email: ["Correo en uso"] },
      };
    }
    console.error("Fallo al crear administrador de instalación:", err);
    return { ok: false, message: "No se pudo crear la cuenta." };
  }

  revalidatePath("/plataforma");
  return {
    ok: true,
    message: `${name} ya administra ${org.name}.`,
  };
}

export type Installation = {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  members: number;
  admins: number;
  assets: number;
  workOrders: number;
};

/** Instalaciones con lo justo para ver de un vistazo cuál quedó a medias. */
export async function listInstallations(): Promise<Installation[]> {
  await requireSuperadmin();

  const rows = (await db.execute(sql`
    SELECT
      o.id, o.name, o.slug,
      to_char(o.created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS "createdAt",
      (SELECT COUNT(*) FROM member m WHERE m.organization_id = o.id)::int AS members,
      (SELECT COUNT(*) FROM member m
        JOIN "user" u ON u.id = m.user_id
        WHERE m.organization_id = o.id AND u.role = 'admin')::int AS admins,
      (SELECT COUNT(*) FROM assets a WHERE a.organization_id = o.id)::int AS assets,
      (SELECT COUNT(*) FROM work_orders w WHERE w.organization_id = o.id)::int AS "workOrders"
    FROM organization o
    ORDER BY o.created_at
  `)) as unknown as Array<Omit<Installation, "createdAt"> & { createdAt: string }>;

  // `db.execute` entrega la fila cruda del driver, sin el mapeo de tipos del
  // query builder: la fecha llega como texto.
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}
