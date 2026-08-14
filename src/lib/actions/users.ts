"use server";

import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getActiveOrgId } from "@/lib/org";
import { SUPERADMIN } from "@/lib/roles";
import { requireRole, ROLES, type Role } from "@/lib/session";
import type { ActionState } from "@/lib/validation";

const ROLE_KEYS = Object.keys(ROLES) as [Role, ...Role[]];

const createSchema = z.object({
  name: z.string().trim().min(3, "El nombre es obligatorio").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password: z
    .string()
    .min(10, "Mínimo 10 caracteres")
    .max(100, "Demasiado larga"),
  role: z.enum(ROLE_KEYS),
});

/**
 * Alta de usuario por el administrador de la instalación.
 *
 * No hay registro público: a bordo las cuentas las crea quien manda en máquinas,
 * no se autogestionan. Por eso `disableSignUp` está activo y esta es la única
 * vía de alta.
 */
export async function createUser(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("admin");

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { name, email, password, role } = parsed.data;

  try {
    const created = await auth.api.createUser({
      body: { name, email, password, role },
      headers: await headers(),
    });

    // Sin la pertenencia la cuenta existe pero no ve nada: la organización es
    // lo que le da acceso a los datos del buque.
    await db.execute(sql`
      INSERT INTO member (id, organization_id, user_id, role, created_at)
      VALUES (${crypto.randomUUID()}, ${await getActiveOrgId()}, ${created.user.id}, 'member', now())
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
    console.error("Fallo al crear usuario:", err);
    return { ok: false, message: "No se pudo crear la cuenta." };
  }

  revalidatePath("/usuarios");
  return { ok: true, message: `Cuenta creada para ${name}.` };
}

export async function changeUserRole(
  userId: string,
  role: string,
): Promise<ActionState> {
  const session = await requireRole("admin");

  if (session.user.id === userId) {
    // Si el único admin se degrada a sí mismo, nadie puede volver a gestionar
    // usuarios sin tocar la base de datos a mano.
    return { ok: false, message: "No puedes cambiar tu propio rol." };
  }
  // El rol llega como string desde el cliente; se valida contra la lista real
  // antes de estrecharlo, para no confiar en lo que envía el navegador.
  if (!(await assertSameOrg(userId))) {
    return { ok: false, message: "No puedes cambiar el rol de alguien de otra instalación." };
  }
  if (!ROLE_KEYS.includes(role as Role)) {
    return { ok: false, message: "Rol desconocido." };
  }
  const validRole = role as Role;

  try {
    await auth.api.setRole({
      body: { userId, role: validRole },
      headers: await headers(),
    });
  } catch (err) {
    console.error("Fallo al cambiar rol:", err);
    return { ok: false, message: "No se pudo cambiar el rol." };
  }

  revalidatePath("/usuarios");
  return { ok: true, message: "Rol actualizado." };
}

/**
 * Deshabilita o rehabilita una cuenta. No se borra: el histórico de órdenes
 * queda ligado a la persona que las ejecutó, y borrar la cuenta rompería la
 * trazabilidad de quién hizo qué.
 */
export async function toggleUserAccess(
  userId: string,
  disable: boolean,
): Promise<ActionState> {
  const session = await requireRole("admin");

  if (!(await assertSameOrg(userId))) {
    return { ok: false, message: "No puedes cambiar el acceso de alguien de otra instalación." };
  }
  if (session.user.id === userId) {
    return { ok: false, message: "No puedes deshabilitar tu propia cuenta." };
  }

  try {
    if (disable) {
      await auth.api.banUser({
        body: { userId, banReason: "Deshabilitada por el administrador" },
        headers: await headers(),
      });
    } else {
      await auth.api.unbanUser({
        body: { userId },
        headers: await headers(),
      });
    }
  } catch (err) {
    console.error("Fallo al cambiar acceso:", err);
    return { ok: false, message: "No se pudo cambiar el acceso." };
  }

  revalidatePath("/usuarios");
  return {
    ok: true,
    message: disable ? "Cuenta deshabilitada." : "Cuenta habilitada.",
  };
}

/** Usuarios de la instalación. */
export async function listUsers() {
  await requireRole("admin");
  const orgId = await getActiveOrgId();

  // Solo la gente de esta instalación: el administrador de un buque no tiene
  // por qué ver —ni tocar— la tripulación de otro.
  const rows = (await db.execute(sql`
    SELECT u.id, u.name, u.email, u.role, u.banned,
           to_char(u.created_at, 'YYYY-MM-DD"T"HH24:MI:SSZ') AS "createdAt"
    FROM "user" u
    JOIN member m ON m.user_id = u.id
    WHERE m.organization_id = ${orgId}
      AND u.role <> ${SUPERADMIN}
    ORDER BY u.created_at
  `)) as unknown as Array<{
    id: string;
    name: string;
    email: string;
    role: string | null;
    banned: boolean | null;
    createdAt: string;
  }>;

  // `db.execute` devuelve la fila cruda del driver, sin el mapeo de tipos que
  // hace el query builder: la fecha llegaba como texto y `Intl` reventaba con
  // "Invalid time value". Se serializa en ISO y se reconstruye aquí.
  return rows.map((r) => ({ ...r, createdAt: new Date(r.createdAt) }));
}

/**
 * Comprueba que un usuario es gestionable desde la instalación activa.
 *
 * Excluye al operador de la plataforma aunque llegara a figurar como miembro:
 * un administrador de buque no puede degradarlo ni dejarlo fuera, que sería la
 * forma más directa de quedarse sin quien pueda arreglar nada.
 */
async function assertSameOrg(userId: string): Promise<boolean> {
  const orgId = await getActiveOrgId();
  const [row] = (await db.execute(sql`
    SELECT 1 AS ok FROM member m
    JOIN "user" u ON u.id = m.user_id
    WHERE m.user_id = ${userId}
      AND m.organization_id = ${orgId}
      AND u.role <> ${SUPERADMIN}
    LIMIT 1
  `)) as unknown as Array<{ ok: number }>;
  return Boolean(row);
}

/** Cambia la contraseña de otra cuenta — para el cadete que la olvidó. */
export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<ActionState> {
  await requireRole("admin");

  if (newPassword.length < 10) {
    return { ok: false, message: "La contraseña necesita al menos 10 caracteres." };
  }
  // Faltaba esta comprobación: sin ella, un administrador que conociera el id
  // de alguien de otra naviera podía cambiarle la contraseña y entrar con ella.
  if (!(await assertSameOrg(userId))) {
    return {
      ok: false,
      message: "No puedes restablecer la contraseña de alguien de otra instalación.",
    };
  }

  try {
    await auth.api.setUserPassword({
      body: { userId, newPassword },
      headers: await headers(),
    });
  } catch (err) {
    console.error("Fallo al restablecer contraseña:", err);
    return { ok: false, message: "No se pudo restablecer la contraseña." };
  }

  return { ok: true, message: "Contraseña restablecida." };
}

/** Comprueba si ya existe al menos una cuenta, para el arranque inicial. */
export async function hasAnyUser(): Promise<boolean> {
  const [row] = await db.select({ id: user.id }).from(user).limit(1);
  return Boolean(row);
}

export async function findUserByEmail(email: string) {
  const [row] = await db
    .select()
    .from(user)
    .where(eq(user.email, email.toLowerCase()))
    .limit(1);
  return row ?? null;
}
