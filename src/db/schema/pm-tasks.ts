import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { pmPlans } from "./pm-plans";
import { workOrders } from "./work-orders";

/**
 * Pauta de una rutina preventiva: qué tiene que hacer el mecánico, paso a paso.
 *
 * Sin esto el plan preventivo es solo una fecha de vencimiento. La pauta es lo
 * que convierte "toca la rutina de 500 horas" en una lista que alguien puede
 * ejecutar en el equipo, y lo que permite después saber **qué se revisó de
 * verdad** y no solo que la orden se cerró.
 *
 * Son dos tablas y no una: `pm_tasks` es la plantilla, que vive en el plan;
 * `work_order_tasks` es la copia que se ejecuta en una orden concreta, con su
 * resultado. Si fueran la misma, cambiar la pauta reescribiría el histórico de
 * lo que se hizo el año pasado.
 */

export const taskKindEnum = pgEnum("task_kind", [
  /** Mirar y confirmar que está bien. */
  "verificacion",
  /** Tomar una lectura con un instrumento y anotarla. */
  "medicion",
  /** Cambiar un componente. */
  "reemplazo",
  /** Lubricar, limpiar, ajustar. */
  "intervencion",
  /** Dejar constancia documental: certificado, respaldo, firma. */
  "registro",
]);

export const taskResultEnum = pgEnum("task_result", [
  "conforme",
  "no_conforme",
  /** No aplicaba en este equipo o en esta ejecución. */
  "no_aplica",
]);

export const pmTasks = pgTable(
  "pm_tasks",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id").notNull(),

    pmPlanId: integer("pm_plan_id")
      .notNull()
      .references(() => pmPlans.id, { onDelete: "cascade" }),

    /** Orden de ejecución. La pauta se sigue en secuencia. */
    sequence: integer("sequence").notNull(),

    description: varchar("description", { length: 300 }).notNull(),
    kind: taskKindEnum("kind").notNull().default("verificacion"),

    /** Unidad esperada cuando la tarea es una medición: mm/s, °C, bar. */
    expectedUnit: varchar("expected_unit", { length: 24 }),

    /**
     * Una tarea obligatoria impide cerrar la rutina sin resultado. Las que no
     * lo son cubren casos que pueden no aplicar en todos los equipos del plan.
     */
    required: boolean("required").notNull().default(true),

    /** Advertencia de seguridad propia del paso, cuando la tiene. */
    safetyNote: text("safety_note"),
  },
  (t) => ({
    orgIdx: index("pm_tasks_org_idx").on(t.organizationId),
    planIdx: index("pm_tasks_plan_idx").on(t.pmPlanId, t.sequence),
  }),
);

export const workOrderTasks = pgTable(
  "work_order_tasks",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id").notNull(),

    workOrderId: integer("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),

    /**
     * Tarea de la plantilla de la que salió. Se conserva la referencia, pero
     * la descripción se copia: si el plan cambia mañana, esta orden debe
     * seguir diciendo lo que realmente se pidió hacer ese día.
     */
    pmTaskId: integer("pm_task_id").references(() => pmTasks.id, {
      onDelete: "set null",
    }),

    sequence: integer("sequence").notNull(),
    description: varchar("description", { length: 300 }).notNull(),
    kind: taskKindEnum("kind").notNull().default("verificacion"),

    result: taskResultEnum("result"),
    /** Valor leído, cuando la tarea era una medición. */
    value: numeric("value", { precision: 14, scale: 4 }),
    unit: varchar("unit", { length: 24 }),
    notes: text("notes"),

    completedAt: timestamp("completed_at", { withTimezone: true }),
    completedBy: varchar("completed_by", { length: 160 }),
  },
  (t) => ({
    orgIdx: index("wo_tasks_org_idx").on(t.organizationId),
    woIdx: index("wo_tasks_wo_idx").on(t.workOrderId, t.sequence),
  }),
);

export const pmTasksRelations = relations(pmTasks, ({ one }) => ({
  plan: one(pmPlans, {
    fields: [pmTasks.pmPlanId],
    references: [pmPlans.id],
  }),
}));

export const workOrderTasksRelations = relations(workOrderTasks, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [workOrderTasks.workOrderId],
    references: [workOrders.id],
  }),
}));

export type PmTask = typeof pmTasks.$inferSelect;
export type NewPmTask = typeof pmTasks.$inferInsert;
export type WorkOrderTask = typeof workOrderTasks.$inferSelect;
export type NewWorkOrderTask = typeof workOrderTasks.$inferInsert;
