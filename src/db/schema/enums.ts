import { pgEnum } from "drizzle-orm/pg-core";

/** Criticidad del activo según impacto en producción/seguridad (matriz ABC). */
export const criticalityEnum = pgEnum("criticality", ["A", "B", "C"]);

/** Estado operativo del activo. */
export const assetStatusEnum = pgEnum("asset_status", [
  "operando",
  "standby",
  "detenido",
  "baja",
]);

/** Tipo de intervención — determina qué OT entran en cada KPI. */
export const woTypeEnum = pgEnum("wo_type", [
  "correctivo",
  "preventivo",
  "predictivo",
  "mejora",
]);

/** Ciclo de vida de la orden de trabajo. */
export const woStatusEnum = pgEnum("wo_status", [
  "abierta",
  "asignada",
  "ejecucion",
  "pausada",
  "cerrada",
  "anulada",
]);

/** Categoría del modo de falla, alineada con ISO 14224. */
export const failureCategoryEnum = pgEnum("failure_category", [
  "mecanica",
  "electrica",
  "instrumentacion",
  "hidraulica",
  "neumatica",
  "operacional",
  "estructural",
]);

export const technicianRoleEnum = pgEnum("technician_role", [
  "tecnico",
  "planificador",
  "jefe",
]);
