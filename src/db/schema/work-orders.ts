import { relations } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { failureModes } from "./failure-modes";
import { technicians } from "./technicians";
import { woStatusEnum, woTypeEnum } from "./enums";

/**
 * Orden de trabajo. Las tres marcas de tiempo son la columna vertebral de los
 * KPIs y por eso no se derivan de `status`:
 *
 *   reportedAt ──► startedAt ──► finishedAt
 *              │             │
 *              └─ respuesta  └─ reparación (MTTR)
 *
 * `downtimeMinutes` se registra aparte porque la parada del activo no siempre
 * coincide con la ventana de reparación (equipo redundante, parada programada).
 */
export const workOrders = pgTable(
  "work_orders",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 24 }).notNull().unique(),
    assetId: integer("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "restrict" }),
    type: woTypeEnum("type").notNull(),
    status: woStatusEnum("status").notNull().default("abierta"),
    /** 1 = urgente … 4 = baja. Prioridad declarada por el solicitante. */
    priority: smallint("priority").notNull().default(3),
    title: varchar("title", { length: 200 }).notNull(),
    description: text("description"),

    failureModeId: integer("failure_mode_id").references(() => failureModes.id, {
      onDelete: "set null",
    }),
    assignedTo: integer("assigned_to").references(() => technicians.id, {
      onDelete: "set null",
    }),

    reportedAt: timestamp("reported_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),

    /** Minutos que el activo estuvo indisponible por esta OT. */
    downtimeMinutes: integer("downtime_minutes").notNull().default(0),
    /** Horas-hombre estimadas — alimentan el backlog cuando la OT sigue abierta. */
    estimatedHours: numeric("estimated_hours", { precision: 8, scale: 2 })
      .notNull()
      .default("0"),
    laborHours: numeric("labor_hours", { precision: 8, scale: 2 })
      .notNull()
      .default("0"),
    laborCost: numeric("labor_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),
    partsCost: numeric("parts_cost", { precision: 12, scale: 2 })
      .notNull()
      .default("0"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    assetIdx: index("wo_asset_idx").on(t.assetId),
    statusIdx: index("wo_status_idx").on(t.status),
    typeIdx: index("wo_type_idx").on(t.type),
    reportedIdx: index("wo_reported_idx").on(t.reportedAt),
    failureModeIdx: index("wo_failure_mode_idx").on(t.failureModeId),
  }),
);

export const workOrdersRelations = relations(workOrders, ({ one }) => ({
  asset: one(assets, {
    fields: [workOrders.assetId],
    references: [assets.id],
  }),
  failureMode: one(failureModes, {
    fields: [workOrders.failureModeId],
    references: [failureModes.id],
  }),
  technician: one(technicians, {
    fields: [workOrders.assignedTo],
    references: [technicians.id],
  }),
}));

export type WorkOrder = typeof workOrders.$inferSelect;
export type NewWorkOrder = typeof workOrders.$inferInsert;
