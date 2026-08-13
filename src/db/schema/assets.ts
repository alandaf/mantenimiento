import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { assetStatusEnum, criticalityEnum } from "./enums";

/**
 * Jerarquía de activos (planta → línea → equipo → componente) mediante
 * autoreferencia en `parentId`.
 */
export const assets = pgTable(
  "assets",
  {
    id: serial("id").primaryKey(),
    /**
     * Organización dueña de la fila. Toda consulta debe filtrar por esta
     * columna: es la frontera entre un buque y otro.
     */
    organizationId: text("organization_id").notNull(),
    tag: varchar("tag", { length: 32 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    parentId: integer("parent_id").references((): any => assets.id, {
      onDelete: "set null",
    }),
    criticality: criticalityEnum("criticality").notNull().default("C"),
    status: assetStatusEnum("status").notNull().default("operando"),
    location: varchar("location", { length: 120 }),
    manufacturer: varchar("manufacturer", { length: 120 }),
    model: varchar("model", { length: 120 }),
    serialNumber: varchar("serial_number", { length: 120 }),
    /** Costo de una hora de parada de este activo — alimenta la priorización. */
    downtimeCostPerHour: integer("downtime_cost_per_hour").notNull().default(0),
    /**
     * Si el activo lleva horómetro. Un tanque o una estructura no acumulan
     * horas de marcha; pedir su lectura sería ruido para quien hace la ronda.
     */
    tracksHours: boolean("tracks_hours").notNull().default(false),
    notes: text("notes"),
    installedAt: timestamp("installed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    // Único por organización: el EQ-101 de un buque no choca con el de otro.
    tagPerOrg: uniqueIndex("assets_org_tag_uq").on(t.organizationId, t.tag),
    orgIdx: index("assets_org_idx").on(t.organizationId),
    parentIdx: index("assets_parent_idx").on(t.parentId),
    criticalityIdx: index("assets_criticality_idx").on(t.criticality),
  }),
);

export const assetsRelations = relations(assets, ({ one, many }) => ({
  parent: one(assets, {
    fields: [assets.parentId],
    references: [assets.id],
    relationName: "asset_hierarchy",
  }),
  children: many(assets, { relationName: "asset_hierarchy" }),
}));

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
