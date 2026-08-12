import { pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { failureCategoryEnum } from "./enums";

/** Catálogo normalizado de modos de falla — la base del análisis de Pareto. */
export const failureModes = pgTable("failure_modes", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 24 }).notNull().unique(),
  name: varchar("name", { length: 160 }).notNull(),
  category: failureCategoryEnum("category").notNull(),
});

export type FailureMode = typeof failureModes.$inferSelect;
export type NewFailureMode = typeof failureModes.$inferInsert;
