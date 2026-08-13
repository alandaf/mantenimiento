import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";

/**
 * Cómo se dispara una rutina preventiva.
 *
 * `horas` es el modo natural del mantenimiento marino y de cualquier equipo
 * rotativo: la rutina vence a las 500 h de marcha, no a los 90 días.
 * `ambos` cubre el caso real más común en un buque — lo que llegue primero,
 * porque el aceite se degrada con el uso pero también con el tiempo.
 */
export const pmTriggerEnum = pgEnum("pm_trigger", ["calendario", "horas", "ambos"]);

export const pmPlans = pgTable(
  "pm_plans",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),

    trigger: pmTriggerEnum("trigger").notNull().default("calendario"),

    /** Cadencia por calendario. Nulo si la rutina solo va por horas. */
    frequencyDays: integer("frequency_days"),
    /** Cadencia por horas de marcha. Nulo si la rutina solo va por calendario. */
    frequencyHours: integer("frequency_hours"),

    estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 })
      .notNull()
      .default("0"),

    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
    /** Lectura del horómetro cuando se ejecutó por última vez. */
    lastExecutedHours: numeric("last_executed_hours", { precision: 12, scale: 1 }),

    nextDueAt: timestamp("next_due_at", { withTimezone: true }),
    /** Horómetro al que vuelve a tocar. */
    nextDueHours: numeric("next_due_hours", { precision: 12, scale: 1 }),

    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    assetIdx: index("pm_asset_idx").on(t.assetId),
    dueIdx: index("pm_due_idx").on(t.nextDueAt),
    dueHoursIdx: index("pm_due_hours_idx").on(t.nextDueHours),
  }),
);

export const pmPlansRelations = relations(pmPlans, ({ one }) => ({
  asset: one(assets, { fields: [pmPlans.assetId], references: [assets.id] }),
}));

export type PmPlan = typeof pmPlans.$inferSelect;
export type NewPmPlan = typeof pmPlans.$inferInsert;
