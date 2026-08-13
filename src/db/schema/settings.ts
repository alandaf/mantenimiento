import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

/**
 * Configuración de la instalación, en base de datos y no en variables de
 * entorno.
 *
 * La diferencia importa: el administrador de un buque tiene que poder corregir
 * la moneda o el nombre de la instalación desde la aplicación, sin acceso al
 * servidor ni un reinicio. Y cuando una instancia atienda a varias
 * organizaciones, cada una necesitará la suya — por eso la fila se identifica
 * por organización desde ahora, aunque hoy solo haya una.
 */
export const settings = pgTable("settings", {
  /**
   * Organización dueña de esta configuración. `default` mientras la instancia
   * atienda a una sola instalación.
   */
  organizationId: varchar("organization_id", { length: 64 })
    .primaryKey()
    .default("default"),

  /** Nombre visible de la instalación: el buque o la planta. */
  installationName: varchar("installation_name", { length: 160 })
    .notNull()
    .default("Instalación"),

  /** Código ISO 4217. Determina el formato de todos los montos. */
  currency: varchar("currency", { length: 3 }).notNull().default("CLP"),

  /** Locale BCP 47: separadores de miles, nombres de mes, orden de fecha. */
  locale: varchar("locale", { length: 12 }).notNull().default("es-CL"),

  /** Notas del administrador. No se usa en cálculos. */
  notes: text("notes"),

  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Settings = typeof settings.$inferSelect;
export type NewSettings = typeof settings.$inferInsert;
