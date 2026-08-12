import { boolean, integer, pgTable, serial, varchar } from "drizzle-orm/pg-core";
import { technicianRoleEnum } from "./enums";

export const technicians = pgTable("technicians", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  role: technicianRoleEnum("role").notNull().default("tecnico"),
  specialty: varchar("specialty", { length: 80 }),
  hourlyRate: integer("hourly_rate").notNull().default(0),
  active: boolean("active").notNull().default(true),
});

export type Technician = typeof technicians.$inferSelect;
export type NewTechnician = typeof technicians.$inferInsert;
