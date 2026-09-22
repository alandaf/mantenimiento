"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { assets, attachments, workOrders } from "@/db/schema";
import { registrarAuditoria } from "@/lib/audit";
import { getActiveOrgId } from "@/lib/org";
import { requireRole } from "@/lib/session";
import { TAMANO_MAXIMO, TIPOS_PERMITIDOS, firmaValida, guardarArchivo } from "@/lib/storage";
import type { ActionState } from "@/lib/validation";

/**
 * Adjuntos de activos y órdenes.
 *
 * Se aceptan también en órdenes cerradas: agregar la foto que faltaba o el
 * informe del laboratorio que llegó una semana después es información nueva,
 * no una corrección de lo registrado.
 */

type Entidad = "activo" | "orden_trabajo";

const CATEGORIAS = [
  "manual",
  "plano",
  "ficha_tecnica",
  "repuestos",
  "foto",
  "informe",
  "certificado",
  "otro",
] as const;

const ETIQUETA: Record<string, string> = {
  manual: "manual",
  plano: "plano",
  ficha_tecnica: "ficha técnica",
  repuestos: "lista de repuestos",
  foto: "foto",
  informe: "informe",
  certificado: "certificado",
  otro: "documento",
};

const base = z.object({
  title: z.string().trim().min(3, "Ponle un título al documento").max(200),
  category: z.enum(CATEGORIAS),
});

const enlaceSchema = base.extend({
  url: z
    .string()
    .trim()
    .url("La dirección no es válida")
    .refine((u) => u.startsWith("https://"), "Solo se aceptan enlaces https://"),
});

function ruta(entidad: Entidad, id: number) {
  return entidad === "activo" ? `/activos/${id}` : `/ordenes/${id}`;
}

/** El registro debe existir y ser de la instalación activa. */
async function existe(entidad: Entidad, id: number, orgId: string): Promise<boolean> {
  const tabla = entidad === "activo" ? assets : workOrders;
  const [fila] = await db
    .select({ id: tabla.id })
    .from(tabla)
    .where(and(eq(tabla.id, id), eq(tabla.organizationId, orgId)))
    .limit(1);
  return !!fila;
}

function error(e: z.ZodError): ActionState {
  return { ok: false, message: e.issues[0]?.message ?? "Datos no válidos." };
}

export async function addAttachment(
  entidad: Entidad,
  entidadId: number,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireRole("tecnico");
  const orgId = await getActiveOrgId();
  if (!(await existe(entidad, entidadId, orgId))) return { ok: false, message: "Ese registro no existe." };

  const tipo = formData.get("kind") === "enlace" ? "enlace" : "archivo";
  let fila: typeof attachments.$inferInsert;

  if (tipo === "enlace") {
    const r = enlaceSchema.safeParse(Object.fromEntries(formData));
    if (!r.success) return error(r.error);
    fila = {
      organizationId: orgId,
      entity: entidad,
      entityId: entidadId,
      kind: "enlace",
      category: r.data.category,
      title: r.data.title,
      url: r.data.url,
      uploadedBy: session.user.name,
    };
  } else {
    const r = base.safeParse(Object.fromEntries(formData));
    if (!r.success) return error(r.error);

    const archivo = formData.get("file");
    if (!(archivo instanceof File) || archivo.size === 0) {
      return { ok: false, message: "Elige un archivo." };
    }
    if (archivo.size > TAMANO_MAXIMO) {
      return {
        ok: false,
        message: `El archivo pesa ${(archivo.size / 1048576).toFixed(1)} MB. El máximo es 10 MB.`,
      };
    }
    if (!TIPOS_PERMITIDOS[archivo.type]) {
      return { ok: false, message: "Solo se aceptan PDF, JPG, PNG y WEBP." };
    }
    const bytes = new Uint8Array(await archivo.arrayBuffer());
    if (!firmaValida(archivo.type, bytes)) {
      return { ok: false, message: "El contenido del archivo no corresponde a su tipo." };
    }

    const storagePath = await guardarArchivo(orgId, archivo.type, bytes);
    fila = {
      organizationId: orgId,
      entity: entidad,
      entityId: entidadId,
      kind: "archivo",
      category: r.data.category,
      title: r.data.title,
      storagePath,
      fileName: archivo.name.slice(0, 200),
      mimeType: archivo.type,
      sizeBytes: archivo.size,
      uploadedBy: session.user.name,
    };
  }

  await db.insert(attachments).values(fila);
  await registrarAuditoria({
    entidad,
    entidadId,
    accion: "modificar",
    cambios: {
      [`Adjunto (${ETIQUETA[fila.category ?? "otro"]})`]: { antes: null, despues: fila.title },
    },
  });

  revalidatePath(ruta(entidad, entidadId));
  return { ok: true, message: tipo === "enlace" ? "Enlace agregado." : "Archivo subido." };
}

/**
 * Retira un adjunto. No lo borra: deja de mostrarse, y queda quién lo retiró
 * y por qué. El archivo sigue en el disco.
 */
export async function retireAttachment(id: number, motivo: string): Promise<ActionState> {
  const session = await requireRole("tecnico");
  const orgId = await getActiveOrgId();

  if (!motivo?.trim() || motivo.trim().length < 5) {
    return { ok: false, message: "Indica por qué se retira el documento." };
  }

  const [adj] = await db
    .select()
    .from(attachments)
    .where(
      and(
        eq(attachments.id, id),
        eq(attachments.organizationId, orgId),
        isNull(attachments.retiredAt),
      ),
    )
    .limit(1);
  if (!adj) return { ok: false, message: "Ese documento no existe o ya fue retirado." };

  await db
    .update(attachments)
    .set({ retiredAt: new Date(), retiredBy: session.user.name, retiredReason: motivo.trim() })
    .where(and(eq(attachments.id, id), eq(attachments.organizationId, orgId)));

  await registrarAuditoria({
    entidad: adj.entity,
    entidadId: adj.entityId,
    accion: "modificar",
    cambios: {
      [`Adjunto retirado (${ETIQUETA[adj.category]})`]: { antes: adj.title, despues: null },
    },
    motivo: motivo.trim(),
  });

  revalidatePath(ruta(adj.entity, adj.entityId));
  return { ok: true };
}
