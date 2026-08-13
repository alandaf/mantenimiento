"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { user } from "@/db/schema";
import { auth } from "@/lib/auth";
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
    await auth.api.createUser({
      body: { name, email, password, role },
      headers: await headers(),
    });
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
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      banned: user.banned,
      createdAt: user.createdAt,
    })
    .from(user)
    .orderBy(user.createdAt);
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
