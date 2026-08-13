"use server";

import { eq } from "drizzle-orm";
import { requireRole } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { assetSchema, toActionState, type ActionState } from "@/lib/validation";

function parse(formData: FormData) {
  return assetSchema.safeParse(Object.fromEntries(formData));
}

export async function createAsset(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("planificador");
  const parsed = parse(formData);
  if (!parsed.success) return toActionState(parsed.error);

  try {
    await db.insert(assets).values(parsed.data);
  } catch (err) {
    return { ok: false, message: uniqueTagMessage(err) };
  }

  revalidatePath("/activos");
  revalidatePath("/dashboard");
  redirect("/activos");
}

export async function updateAsset(
  id: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("planificador");
  const parsed = parse(formData);
  if (!parsed.success) return toActionState(parsed.error);

  // Un activo no puede ser su propio padre: rompería el recorrido de la jerarquía.
  if (parsed.data.parentId === id) {
    return {
      ok: false,
      message: "Un activo no puede depender de sí mismo.",
      errors: { parentId: ["Selecciona otro activo padre"] },
    };
  }

  try {
    await db.update(assets).set(parsed.data).where(eq(assets.id, id));
  } catch (err) {
    return { ok: false, message: uniqueTagMessage(err) };
  }

  revalidatePath("/activos");
  revalidatePath("/dashboard");
  redirect("/activos");
}

export async function deleteAsset(id: number): Promise<ActionState> {
  await requireRole("planificador");
  try {
    await db.delete(assets).where(eq(assets.id, id));
  } catch {
    // La FK de work_orders es RESTRICT: el histórico de OT no se pierde nunca.
    return {
      ok: false,
      message:
        "No se puede eliminar: el activo tiene órdenes de trabajo asociadas. Cámbialo a estado «baja».",
    };
  }

  revalidatePath("/activos");
  revalidatePath("/dashboard");
  return { ok: true, message: "Activo eliminado." };
}

function uniqueTagMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (message.includes("assets_tag_unique") || message.includes("duplicate key")) {
    return "Ya existe un activo con ese tag.";
  }
  return "No se pudo guardar el activo.";
}
