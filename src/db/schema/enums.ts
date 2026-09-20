import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Criticidad del activo según impacto en producción y seguridad.
 *
 * Cuatro niveles y no tres: en una instalación con sistemas de seguridad hay
 * que poder distinguir lo que **no puede fallar** —una válvula de aislamiento,
 * un detector de gas, una parada de emergencia— de lo que es simplemente
 * importante. Con una sola letra "A" para ambos, las reglas que dan prioridad
 * obligatoria a la seguridad no tendrían sobre qué apoyarse.
 */
export const criticalityEnum = pgEnum("criticality", [
  "critica",
  "alta",
  "media",
  "baja",
]);

/**
 * Tipo de activo. Describe **qué es** el equipo, no cuánto importa —eso es la
 * criticidad—. Sirve para comparar entre iguales: el MTBF de una bomba solo
 * dice algo frente al de otras bombas.
 */
export const assetTypeEnum = pgEnum("asset_type", [
  "sistema",
  "conjunto",
  "bomba",
  "motor",
  "compresor",
  "valvula",
  "instrumento",
  "controlador",
  "tablero",
  "recipiente",
  "intercambiador",
  "transportador",
  "maquina",
  "vehiculo",
  "generador",
  "seguridad",
  "otro",
]);

/** Estado operativo del activo. */
export const assetStatusEnum = pgEnum("asset_status", [
  "operando",
  // Funciona pero por debajo de su capacidad: sirve para no tener que elegir
  // entre "todo bien" y "detenido" cuando la realidad está en medio.
  "degradado",
  "standby",
  "detenido",
  "baja",
]);

/** Tipo de intervención — determina qué OT entran en cada KPI. */
export const woTypeEnum = pgEnum("wo_type", [
  "correctivo",
  "preventivo",
  "predictivo",
  "inspeccion",
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

/**
 * Qué cuenta el contador del activo.
 *
 * No todo se mide en horas: una envasadora se desgasta por cilindros llenados
 * y una correa por toneladas transportadas. Programar por horas un equipo que
 * se desgasta por ciclos produce rutinas que llegan tarde o sobran.
 */
export const meterTypeEnum = pgEnum("meter_type", [
  "horas",
  "ciclos",
  "produccion",
  "kilometros",
  "otro",
]);
