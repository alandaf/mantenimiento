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
  varchar,
} from "drizzle-orm/pg-core";
import { workOrders } from "./work-orders";

/**
 * Mediciones tomadas durante una intervención.
 *
 * Tabla propia y no un campo de texto en la orden. La diferencia importa: así
 * se puede preguntar "cómo evolucionó la vibración de esta bomba en el año",
 * que es exactamente la pregunta que convierte un histórico de reparaciones en
 * mantenimiento predictivo. Con un texto libre esa consulta no existe.
 */

export const measurementMomentEnum = pgEnum("measurement_moment", [
  "antes",
  "despues",
]);

export const measurements = pgTable(
  "measurements",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id").notNull(),

    workOrderId: integer("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),

    /** Antes de intervenir o después de reponer el servicio. */
    moment: measurementMomentEnum("moment").notNull(),

    /** Qué se midió: vibración, temperatura, presión, aislación. */
    variable: varchar("variable", { length: 80 }).notNull(),

    value: numeric("value", { precision: 14, scale: 4 }).notNull(),

    /** Unidad tal como la usa el instrumento: mm/s, °C, bar, MΩ. */
    unit: varchar("unit", { length: 24 }).notNull(),

    /**
     * Umbral de referencia, cuando existe. Permite marcar en pantalla si la
     * lectura está fuera de rango sin que el usuario tenga que recordar el
     * límite de cada equipo.
     */
    threshold: numeric("threshold", { precision: 14, scale: 4 }),

    takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
    notes: text("notes"),
  },
  (t) => ({
    orgIdx: index("measurements_org_idx").on(t.organizationId),
    woIdx: index("measurements_wo_idx").on(t.workOrderId),
    // La consulta que da valor a esto: la serie de una variable en el tiempo.
    serieIdx: index("measurements_serie_idx").on(t.variable, t.takenAt),
  }),
);

export const measurementsRelations = relations(measurements, ({ one }) => ({
  workOrder: one(workOrders, {
    fields: [measurements.workOrderId],
    references: [workOrders.id],
  }),
}));

/**
 * Materiales usados en una intervención.
 *
 * También en tabla propia: `parts_cost` dice cuánto se gastó, esto dice en qué.
 * Sin el detalle no se puede responder qué repuesto se está consumiendo de más,
 * que suele ser la pista de un problema de fondo.
 */
export const workOrderMaterials = pgTable(
  "work_order_materials",
  {
    id: serial("id").primaryKey(),
    organizationId: text("organization_id").notNull(),

    workOrderId: integer("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),

    description: varchar("description", { length: 200 }).notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 3 }).notNull().default("1"),
    unit: varchar("unit", { length: 24 }),
    unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull().default("0"),
    /** Código del repuesto en el catálogo del fabricante, si se conoce. */
    partNumber: varchar("part_number", { length: 80 }),
  },
  (t) => ({
    orgIdx: index("materials_org_idx").on(t.organizationId),
    woIdx: index("materials_wo_idx").on(t.workOrderId),
  }),
);

export const workOrderMaterialsRelations = relations(
  workOrderMaterials,
  ({ one }) => ({
    workOrder: one(workOrders, {
      fields: [workOrderMaterials.workOrderId],
      references: [workOrders.id],
    }),
  }),
);

export type Measurement = typeof measurements.$inferSelect;
export type NewMeasurement = typeof measurements.$inferInsert;
export type WorkOrderMaterial = typeof workOrderMaterials.$inferSelect;
export type NewWorkOrderMaterial = typeof workOrderMaterials.$inferInsert;
