import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { technicianRoleEnum } from "./enums";

export const technicians = pgTable(
  "technicians",
  {
    id: serial("id").primaryKey(),
    /**
     * Organización dueña de la fila. Toda consulta debe filtrar por esta
     * columna: es la frontera entre un buque y otro.
     */
    organizationId: text("organization_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull(),
    role: technicianRoleEnum("role").notNull().default("tecnico"),
    specialty: varchar("specialty", { length: 80 }),
    hourlyRate: integer("hourly_rate").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => ({
    // Una misma persona puede estar en dos buques de la misma naviera.
    emailPerOrg: uniqueIndex("tech_org_email_uq").on(t.organizationId, t.email),
  }),
);

export type Technician = typeof technicians.$inferSelect;
export type NewTechnician = typeof technicians.$inferInsert;
