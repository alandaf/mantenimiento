import { relations } from "drizzle-orm";
import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  uniqueIndex,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { assets } from "./assets";
import { failureModes } from "./failure-modes";
import { pmPlans } from "./pm-plans";
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
    /**
     * Organización dueña de la fila. Toda consulta debe filtrar por esta
     * columna: es la frontera entre un buque y otro.
     */
    organizationId: text("organization_id").notNull(),
    code: varchar("code", { length: 24 }).notNull(),
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
    /**
     * Plan preventivo que originó esta orden. Al cerrarla se avanza la cadencia
     * del plan; sin este vínculo habría que adivinar por nombre y activo, que
     * falla en cuanto dos rutinas se parecen.
     */
    pmPlanId: integer("pm_plan_id").references(() => pmPlans.id, {
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

    /**
     * Síntoma informado, causa confirmada y trabajo realizado, como tres
     * campos distintos.
     *
     * Parece redundante y no lo es: "vibración elevada" es lo que se reportó,
     * "desalineación de acople" es lo que se encontró, y "reemplazo de
     * rodamiento" es lo que se hizo. Con un solo campo de texto libre los tres
     * se mezclan, y después no hay forma de analizar si lo que se reporta
     * coincide con lo que se encuentra.
     */
    symptom: text("symptom"),
    causeFound: text("cause_found"),
    actionPerformed: text("action_performed"),

    /** Referencia del permiso de trabajo autorizado, cuando aplica. */
    workPermitRef: varchar("work_permit_ref", { length: 80 }),

    /**
     * Ventana real de indisponibilidad del equipo.
     *
     * `downtimeMinutes` dice cuánto; esto dice desde cuándo y hasta cuándo, que
     * es lo que permite cruzar una parada con lo que pasaba en la planta a esa
     * hora.
     */
    unavailableAt: timestamp("unavailable_at", { withTimezone: true }),
    returnedToServiceAt: timestamp("returned_to_service_at", {
      withTimezone: true,
    }),

    /**
     * Aprobación del trabajo. Quién y cuándo.
     *
     * La regla que la acompaña es que en trabajos críticos el aprobador no
     * puede ser el ejecutor. No es burocracia: quien hizo la reparación es la
     * persona con menos distancia para juzgar si quedó bien.
     */
    approvedBy: text("approved_by"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    codePerOrg: uniqueIndex("wo_org_code_uq").on(t.organizationId, t.code),
    orgIdx: index("wo_org_idx").on(t.organizationId),
    assetIdx: index("wo_asset_idx").on(t.assetId),
    statusIdx: index("wo_status_idx").on(t.status),
    typeIdx: index("wo_type_idx").on(t.type),
    reportedIdx: index("wo_reported_idx").on(t.reportedAt),
    failureModeIdx: index("wo_failure_mode_idx").on(t.failureModeId),
    pmPlanIdx: index("wo_pm_plan_idx").on(t.pmPlanId),
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
