import { pgTable, serial, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { failureCategoryEnum } from "./enums";

/** Catálogo normalizado de modos de falla — la base del análisis de Pareto. */
export const failureModes = pgTable(
  "failure_modes",
  {
    id: serial("id").primaryKey(),
    /**
     * Organización dueña de la fila. Toda consulta debe filtrar por esta
     * columna: es la frontera entre un buque y otro.
     */
    organizationId: text("organization_id").notNull(),
    code: varchar("code", { length: 24 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: failureCategoryEnum("category").notNull(),
  },
  (t) => ({
    // Único por organización, no global: dos buques tienen cada uno su FM-001.
    codePerOrg: uniqueIndex("fm_org_code_uq").on(t.organizationId, t.code),
  }),
);

export type FailureMode = typeof failureModes.$inferSelect;
export type NewFailureMode = typeof failureModes.$inferInsert;
