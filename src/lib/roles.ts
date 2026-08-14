/**
 * Roles y jerarquía. Deliberadamente sin dependencias de servidor: los
 * componentes cliente necesitan las etiquetas, y si esto viviera junto a
 * `next/headers` arrastraría código de servidor al bundle del navegador.
 */
export const ROLES = {
  admin: "Administrador",
  jefe: "Jefe de Máquinas",
  planificador: "Planificador",
  tecnico: "Técnico",
  lectura: "Solo lectura",
} as const;

export type Role = keyof typeof ROLES;

/** Jerarquía: quien está más arriba puede todo lo de abajo. */
const RANK: Record<Role, number> = {
  admin: 5,
  jefe: 4,
  planificador: 3,
  tecnico: 2,
  lectura: 1,
};

export function hasRole(role: string | null | undefined, minimum: Role): boolean {
  const r = (role ?? "lectura") as Role;
  return (RANK[r] ?? 0) >= RANK[minimum];
}

/**
 * Operador de la plataforma. Deliberadamente **fuera** de `ROLES` y de la
 * jerarquía: no es el escalón siguiente de `admin`, es otro eje. Mantenerlo
 * fuera es lo que impide que aparezca en el desplegable de roles del buque y
 * que un administrador se ascienda solo — el esquema de validación del alta de
 * usuarios se construye sobre `ROLES`, así que este valor nunca lo pasa.
 */
export const SUPERADMIN = "superadmin";

export function isSuperadmin(role: string | null | undefined): boolean {
  return role === SUPERADMIN;
}
