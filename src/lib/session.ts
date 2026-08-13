import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";
import { hasRole, type Role } from "./roles";

/** Sesión actual, o `null` si no hay. */
export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/**
 * Exige sesión. Es la única puerta del árbol autenticado: el layout de (app)
 * la invoca una vez y protege todo lo que cuelga de él, para que una página
 * nueva no quede abierta por olvido.
 */
export async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Exige un rol mínimo. */
export async function requireRole(minimum: Role) {
  const session = await requireSession();
  if (!hasRole(session.user.role, minimum)) redirect("/dashboard");
  return session;
}

/**
 * Igual que requireSession pero para route handlers, que no pueden redirigir:
 * devuelven 401 y el cliente decide qué hacer.
 */
export async function requireSessionOrUnauthorized() {
  const session = await getSession();
  if (!session) {
    return {
      session: null,
      response: Response.json({ error: "No autenticado" }, { status: 401 }),
    };
  }
  return { session, response: null };
}

export { hasRole, ROLES, type Role } from "./roles";
