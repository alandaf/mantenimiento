import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";

/** Plan de mantenimiento preventivo por calendario. Alimenta el KPI de cumplimiento. */
export const pmPlans = pgTable(
  "pm_plans",
  {
    id: serial("id").primaryKey(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    frequencyDays: integer("frequency_days").notNull(),
    estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 })
      .notNull()
      .default("0"),
    lastExecutedAt: timestamp("last_executed_at", { withTimezone: true }),
    nextDueAt: timestamp("next_due_at", { withTimezone: true }).notNull(),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    assetIdx: index("pm_asset_idx").on(t.assetId),
    dueIdx: index("pm_due_idx").on(t.nextDueAt),
  }),
);

export const pmPlansRelations = relations(pmPlans, ({ one }) => ({
  asset: one(assets, { fields: [pmPlans.assetId], references: [assets.id] }),
}));

export type PmPlan = typeof pmPlans.$inferSelect;
export type NewPmPlan = typeof pmPlans.$inferInsert;
