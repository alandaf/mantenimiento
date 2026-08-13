import { relations } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";

/** De dónde vino la lectura: importa para auditar una cifra sospechosa. */
export const readingSourceEnum = pgEnum("reading_source", [
  "manual",
  "importacion",
  "automatico",
]);

/**
 * Lecturas de horómetro.
 *
 * El mantenimiento marino no se programa por calendario sino por horas de
 * marcha: un auxiliar que estuvo tres meses parado en dique no necesita su
 * rutina de 500 h, y uno que hizo dos travesías seguidas la necesita antes.
 *
 * Se guardan lecturas, no un contador mutable, por dos razones: el histórico
 * permite calcular el ritmo de uso real (h/día) para proyectar cuándo vence la
 * próxima rutina, y una lectura mal tecleada se corrige sin perder las demás.
 */
export const meterReadings = pgTable(
  "meter_readings",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    /** Lectura acumulada del horómetro, en horas. */
    hours: numeric("hours", { precision: 12, scale: 1 }).notNull(),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    source: readingSourceEnum("source").notNull().default("manual"),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    assetIdx: index("meter_asset_idx").on(t.assetId, t.takenAt),
    // Dos lecturas del mismo activo en el mismo instante son un doble envío,
    // no un dato: la restricción lo impide en la base, no solo en la UI.
    uniquePerMoment: uniqueIndex("meter_asset_moment_uq").on(t.assetId, t.takenAt),
  }),
);

export const meterReadingsRelations = relations(meterReadings, ({ one }) => ({
  asset: one(assets, {
    fields: [meterReadings.assetId],
    references: [assets.id],
  }),
}));

export type MeterReading = typeof meterReadings.$inferSelect;
export type NewMeterReading = typeof meterReadings.$inferInsert;
