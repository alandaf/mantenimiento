import { redirect } from "next/navigation";
import { isSuperadmin } from "./roles";
import { requireSession } from "./session";

/**
 * Puerta de la consola de plataforma.
 *
 * Se separa de `requireRole` a propósito: aquella recorre la jerarquía del
 * buque, y el operador de la plataforma no está en esa escalera. Un
 * administrador de instalación —por muy arriba que esté en su buque— no debe
 * poder dar de alta clientes.
 *
 * Quien no lo sea vuelve al dashboard, no a un 403: para él esta ruta no
 * existe, y confirmarle que existe es información que no necesita.
 */
export async function requireSuperadmin() {
  const session = await requireSession();
  if (!isSuperadmin(session.user.role)) redirect("/dashboard");
  return session;
}
