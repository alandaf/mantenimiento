import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Bitácora de toda salida generada por IA. Se persiste el modelo, el prompt y
 * los datos exactos que recibió, de modo que cualquier recomendación sea
 * reproducible y auditable (requisito para ISO 55001).
 *
 * Se crea en F1 aunque el módulo de IA llega en F3: así el histórico arranca
 * completo desde la primera llamada.
 */
export const aiInsights = pgTable(
  "ai_insights",
  {
    id: serial("id").primaryKey(),
    /** "priorizacion" | "rca" | "resumen_ejecutivo" … */
    scope: varchar("scope", { length: 40 }).notNull(),
    /** Id de la entidad analizada (OT, activo). Nulo si es global. */
    refId: integer("ref_id"),
    model: varchar("model", { length: 60 }).notNull(),
    prompt: text("prompt").notNull(),
    /** Datos deterministas que se le pasaron al modelo vía tool use. */
    inputData: jsonb("input_data"),
    output: jsonb("output"),
    tokensIn: integer("tokens_in"),
    tokensOut: integer("tokens_out"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    scopeIdx: index("ai_scope_idx").on(t.scope, t.refId),
  }),
);

export type AiInsight = typeof aiInsights.$inferSelect;
