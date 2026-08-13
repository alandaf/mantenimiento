import { sql } from "drizzle-orm";
import { db } from "@/db";
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
  const session = await getSession();
  if (!session) throw new Error("Sin sesión: no hay organización activa.");

  const active = session.session.activeOrganizationId;
  if (active) return active;

  // Si la sesión no la trae (primer acceso tras el alta), se toma la
  // pertenencia del usuario. Con una sola organización esto es lo normal.
  const [row] = (await db.execute(sql`
    SELECT organization_id FROM member WHERE user_id = ${session.user.id}
    ORDER BY created_at LIMIT 1
  `)) as unknown as Array<{ organization_id: string }>;

  if (!row) {
    throw new Error(
      "El usuario no pertenece a ninguna instalación. Contacta al administrador.",
    );
  }
  return row.organization_id;
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
