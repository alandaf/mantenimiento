import { desc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, type AuditLog } from "@/db/schema";
import { getActiveOrgId } from "./org";
import { getSession } from "./session";

/**
 * Escritura y lectura del registro de auditoría.
 *
 * El registro se escribe **después** de que la operación tuvo éxito, nunca
 * antes: anotar una intención que luego falla produce un histórico que miente,
 * y es peor que no tener histórico.
 */

type Entidad =
  | "orden_trabajo"
  | "activo"
  | "plan_preventivo"
  | "usuario"
  | "configuracion"
  | "lectura_horometro";

type Accion =
  | "crear"
  | "modificar"
  | "cambiar_estado"
  | "cambiar_prioridad"
  | "reasignar"
  | "cerrar"
  | "anular"
  | "reabrir"
  | "aprobar"
  | "rechazar";

/** Acciones que exigen motivo: las que alteran lo que cuentan los indicadores. */
const EXIGEN_MOTIVO: ReadonlySet<Accion> = new Set([
  "anular",
  "reabrir",
  "rechazar",
]);

export type CambioAuditado = {
  entidad: Entidad;
  entidadId: string | number;
  accion: Accion;
  /** Solo los campos que cambiaron, con su valor anterior y el nuevo. */
  cambios?: Record<string, { antes: unknown; despues: unknown }>;
  motivo?: string | null;
};

export class MotivoRequeridoError extends Error {
  constructor(accion: Accion) {
    super(`La acción "${accion}" exige un motivo.`);
    this.name = "MotivoRequeridoError";
  }
}

export async function registrarAuditoria(cambio: CambioAuditado): Promise<void> {
  if (EXIGEN_MOTIVO.has(cambio.accion) && !cambio.motivo?.trim()) {
    throw new MotivoRequeridoError(cambio.accion);
  }

  const session = await getSession();
  if (!session) return;

  await db.insert(auditLog).values({
    organizationId: await getActiveOrgId(),
    entity: cambio.entidad,
    entityId: String(cambio.entidadId),
    action: cambio.accion,
    actorUserId: session.user.id,
    // Nombre y correo del momento: si la cuenta cambia después, el registro
    // debe seguir diciendo quién era esa persona cuando actuó.
    actorName: session.user.name,
    actorEmail: session.user.email,
    actorRole: session.user.role ?? null,
    changes: cambio.cambios ?? null,
    reason: cambio.motivo?.trim() || null,
  });
}

/**
 * Compara dos versiones y devuelve solo lo que cambió.
 *
 * Guardar el registro entero antes y después hace el histórico ilegible: quien
 * lo consulta quiere ver "la prioridad pasó de 3 a 1", no dos objetos de
 * veinte campos para compararlos a ojo.
 */
export function diferencias<T extends Record<string, unknown>>(
  antes: T,
  despues: Partial<T>,
): Record<string, { antes: unknown; despues: unknown }> | undefined {
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};

  for (const [campo, valorNuevo] of Object.entries(despues)) {
    const valorViejo = antes[campo];
    const iguales =
      valorViejo instanceof Date && valorNuevo instanceof Date
        ? valorViejo.getTime() === valorNuevo.getTime()
        : String(valorViejo ?? "") === String(valorNuevo ?? "");
    if (!iguales) cambios[campo] = { antes: valorViejo, despues: valorNuevo };
  }

  return Object.keys(cambios).length > 0 ? cambios : undefined;
}

/** Historial de un registro, del más reciente al más antiguo. */
export async function historialDe(
  entidad: Entidad,
  entidadId: string | number,
): Promise<AuditLog[]> {
  const orgId = await getActiveOrgId();
  return db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.organizationId, orgId),
        eq(auditLog.entity, entidad),
        eq(auditLog.entityId, String(entidadId)),
      ),
    )
    .orderBy(desc(auditLog.createdAt));
}
