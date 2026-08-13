import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

/**
 * Permisos por rol, con el vocabulario del rubro.
 *
 * Se declaran aquí y no como una lista de nombres sueltos porque el plugin de
 * administración necesita saber qué puede hacer cada rol; sin esto solo
 * existirían "user" y "admin", que no describen una sala de máquinas.
 */
export const statement = {
  ...defaultStatements,
  /** Órdenes de trabajo. */
  ot: ["ver", "crear", "editar", "cerrar"],
  /** Lecturas de horómetro y planes preventivos. */
  mantenimiento: ["ver", "registrar", "planificar"],
  /** Carga masiva de datos. */
  datos: ["importar"],
  /** Análisis asistidos por IA, que tienen costo por uso. */
  ia: ["ejecutar"],
} as const;

export const ac = createAccessControl(statement);

/** Consulta tableros y reportes; no modifica nada. */
export const lectura = ac.newRole({
  ot: ["ver"],
  mantenimiento: ["ver"],
});

/** Ejecuta el trabajo del turno: registra lecturas y cierra órdenes. */
export const tecnico = ac.newRole({
  ot: ["ver", "crear", "editar", "cerrar"],
  mantenimiento: ["ver", "registrar"],
  ia: ["ejecutar"],
});

/** Además organiza el plan y carga históricos. */
export const planificador = ac.newRole({
  ot: ["ver", "crear", "editar", "cerrar"],
  mantenimiento: ["ver", "registrar", "planificar"],
  datos: ["importar"],
  ia: ["ejecutar"],
});

/** Todo el mantenimiento; no administra cuentas. */
export const jefe = ac.newRole({
  ot: ["ver", "crear", "editar", "cerrar"],
  mantenimiento: ["ver", "registrar", "planificar"],
  datos: ["importar"],
  ia: ["ejecutar"],
});

/** Lo del jefe, más la gestión de cuentas de la instalación. */
export const admin = ac.newRole({
  ...adminAc.statements,
  ot: ["ver", "crear", "editar", "cerrar"],
  mantenimiento: ["ver", "registrar", "planificar"],
  datos: ["importar"],
  ia: ["ejecutar"],
});

export const roles = { lectura, tecnico, planificador, jefe, admin };
