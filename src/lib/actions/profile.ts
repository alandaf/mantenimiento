"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import type { ActionState } from "@/lib/validation";

/**
 * Perfil propio: nombre y contraseña.
 *
 * Faltaba por completo. Un administrador podía restablecer la contraseña de
 * otros, pero nadie —ni siquiera el operador de la plataforma— podía cambiar la
 * suya. Y las cuentas nacen con una contraseña que eligió otra persona: sin
 * esta pantalla, esa contraseña provisional se queda para siempre.
 */

const nameSchema = z.object({
  name: z.string().trim().min(3, "El nombre es obligatorio").max(120),
});

export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const parsed = nameSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    await auth.api.updateUser({
      body: { name: parsed.data.name },
      headers: await headers(),
    });
  } catch (err) {
    console.error("Fallo al actualizar el perfil:", err);
    return { ok: false, message: "No se pudo guardar el nombre." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Nombre actualizado." };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Escribe tu contraseña actual"),
    newPassword: z
      .string()
      .min(10, "Mínimo 10 caracteres")
      .max(100, "Demasiado larga"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Las contraseñas no coinciden",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "La nueva contraseña es igual a la actual",
    path: ["newPassword"],
  });

export async function changeOwnPassword(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSession();

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisa los campos marcados.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        // Las demás sesiones se cierran. Si la contraseña se cambia porque
        // alguien más la conocía, dejar sus sesiones vivas no arreglaría nada.
        revokeOtherSessions: true,
      },
      headers: await headers(),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    if (/invalid|incorrect|password/i.test(raw)) {
      return {
        ok: false,
        message: "La contraseña actual no es correcta.",
        errors: { currentPassword: ["No coincide"] },
      };
    }
    console.error("Fallo al cambiar la contraseña:", err);
    return { ok: false, message: "No se pudo cambiar la contraseña." };
  }

  return {
    ok: true,
    message: "Contraseña cambiada. Se cerraron las demás sesiones abiertas.",
  };
}
