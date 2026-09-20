import { index, jsonb, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Registro de auditoría.
 *
 * Qué se hizo, quién y cuándo. Existe porque un histórico que se puede
 * reescribir sin dejar rastro deja de ser evidencia: si mañana una orden
 * aparece cerrada y nadie sabe quién la cerró ni con qué datos, el sistema no
 * sirve para responder la única pregunta que importa después de un incidente.
 *
 * Es de solo escritura. Nada en la aplicación borra ni modifica una fila de
 * aquí, y por eso no hay acción de edición: un registro que se puede corregir
 * no prueba nada.
 */

export const auditActionEnum = pgEnum("audit_action", [
  "crear",
  "modificar",
  "cambiar_estado",
  "cambiar_prioridad",
  "reasignar",
  "cerrar",
  "anular",
  "reabrir",
  "aprobar",
  "rechazar",
]);

export const auditEntityEnum = pgEnum("audit_entity", [
  "orden_trabajo",
  "activo",
  "plan_preventivo",
  "usuario",
  "configuracion",
  "lectura_horometro",
]);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id").notNull(),

    entity: auditEntityEnum("entity").notNull(),
    /** Identificador del registro afectado, como texto por ser de tipos distintos. */
    entityId: varchar("entity_id", { length: 64 }).notNull(),
    action: auditActionEnum("action").notNull(),

    /**
     * Quién lo hizo. Se guarda también el nombre y el correo del momento: si
     * la cuenta cambia de nombre o se deshabilita, el registro debe seguir
     * diciendo quién era esa persona cuando actuó.
     */
    actorUserId: text("actor_user_id"),
    actorName: varchar("actor_name", { length: 160 }).notNull(),
    actorEmail: varchar("actor_email", { length: 200 }).notNull(),
    actorRole: varchar("actor_role", { length: 40 }),

    /** Campos que cambiaron: solo los que cambiaron, con su valor anterior y nuevo. */
    changes: jsonb("changes"),

    /**
     * Motivo declarado. Obligatorio al anular, reabrir o rechazar: son las
     * acciones que alteran lo que cuentan los indicadores, y sin motivo se
     * vuelven la forma elegante de maquillar las cifras.
     */
    reason: text("reason"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    orgIdx: index("audit_org_idx").on(t.organizationId),
    // La consulta habitual es "qué le pasó a esta orden", así que el índice va
    // por entidad y registro, no solo por fecha.
    entityIdx: index("audit_entity_idx").on(t.entity, t.entityId),
    createdIdx: index("audit_created_idx").on(t.createdAt),
  }),
);

export type AuditLog = typeof auditLog.$inferSelect;
export type NewAuditLog = typeof auditLog.$inferInsert;
