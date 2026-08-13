import { sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { isSuperadmin } from "./roles";
import { getSession } from "./session";

/**
 * Organización activa de la sesión.
 *
 * Es la frontera entre un buque y otro: **toda** consulta de dominio debe
 * filtrar por este valor. Se resuelve desde la sesión, nunca desde un parámetro
 * de la petición — si viniera de la URL, cambiar un número en la barra de
 * direcciones daría acceso a la flota ajena.
 */
export async function getActiveOrgId(): Promise<string> {
  const orgId = await findActiveOrgId();
  if (orgId) return orgId;

  // Sin organización no hay nada que consultar, así que se corta aquí.
  //
  // Se redirige en vez de lanzar por cómo renderiza Next: el layout y la página
  // se ejecutan **en paralelo**, así que una comprobación en el layout no
  // impide que la página lance su consulta. Lanzar dejaba una excepción en el
  // log en cada carga; `redirect()` es una señal que el framework entiende y
  // detiene el render limpiamente, desde cualquier punto que llame aquí.
  const session = await getSession();
  redirect(isSuperadmin(session?.user.role) ? "/plataforma" : "/sin-instalacion");
}

/** Variante que devuelve `null` en vez de redirigir. */
export async function findActiveOrgId(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;

  // La organización de la sesión se contrasta contra la pertenencia real: una
  // sesión abierta desde antes puede apuntar a una instalación de la que al
  // usuario ya se le dio de baja, y ese identificador no puede seguir abriendo
  // sus datos. Si no valida, se cae a la primera pertenencia vigente.
  const active = session.session.activeOrganizationId;
  const [row] = (await db.execute(sql`
    SELECT organization_id FROM member
    WHERE user_id = ${session.user.id}
    ORDER BY (organization_id = ${active ?? ""}) DESC, created_at
    LIMIT 1
  `)) as unknown as Array<{ organization_id: string }>;

  return row?.organization_id ?? null;
}

/** Organizaciones a las que pertenece el usuario, para el selector. */
export async function getUserOrganizations() {
  const session = await getSession();
  if (!session) return [];

  return (await db.execute(sql`
    SELECT o.id, o.name, o.slug, m.role
    FROM member m
    JOIN organization o ON o.id = m.organization_id
    WHERE m.user_id = ${session.user.id}
    ORDER BY o.name
  `)) as unknown as Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
}
