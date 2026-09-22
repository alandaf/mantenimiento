import {
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Documentos asociados a un activo o a una orden: manuales, planos, fichas,
 * fotos de evidencia, informes.
 *
 * Dos formas, no una:
 * - `archivo`: lo sube la planta y queda en el disco del servidor. Fotos,
 *   informes, sus propios planos.
 * - `enlace`: apunta al documento publicado por el fabricante. No se copia:
 *   el manual es suyo, y el enlace lleva siempre a su versión vigente.
 *
 * Un documento no se borra, se retira. La foto del sello dañado es evidencia
 * de lo que se encontró; si alguien la quita, tiene que quedar quién y por qué.
 */

export const attachmentEntityEnum = pgEnum("attachment_entity", [
  "activo",
  "orden_trabajo",
]);

export const attachmentKindEnum = pgEnum("attachment_kind", ["archivo", "enlace"]);

export const attachmentCategoryEnum = pgEnum("attachment_category", [
  "manual",
  "plano",
  "ficha_tecnica",
  "repuestos",
  "foto",
  "informe",
  "certificado",
  "otro",
]);

export const attachments = pgTable(
  "attachments",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id").notNull(),

    entity: attachmentEntityEnum("entity").notNull(),
    entityId: integer("entity_id").notNull(),

    kind: attachmentKindEnum("kind").notNull(),
    category: attachmentCategoryEnum("category").notNull().default("otro"),
    title: varchar("title", { length: 200 }).notNull(),

    /** Solo en enlaces: la dirección del documento del fabricante. */
    url: text("url"),

    /**
     * Solo en archivos: ruta relativa a la carpeta de adjuntos. Nunca el
     * nombre que puso el usuario: ese viaja en `fileName` y la ruta la genera
     * el servidor, para que nadie pueda escribir fuera de la carpeta.
     */
    storagePath: varchar("storage_path", { length: 200 }),
    fileName: varchar("file_name", { length: 200 }),
    mimeType: varchar("mime_type", { length: 80 }),
    sizeBytes: integer("size_bytes"),

    uploadedBy: varchar("uploaded_by", { length: 160 }).notNull(),
    uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),

    retiredAt: timestamp("retired_at", { withTimezone: true }),
    retiredBy: varchar("retired_by", { length: 160 }),
    retiredReason: text("retired_reason"),
  },
  (t) => ({
    orgIdx: index("attachments_org_idx").on(t.organizationId),
    entityIdx: index("attachments_entity_idx").on(t.entity, t.entityId),
  }),
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
