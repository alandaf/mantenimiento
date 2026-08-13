import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
import { assets, failureModes, technicians } from "@/db/schema";

/** Catálogos que alimentan los selects del formulario de OT. */
export async function getWorkOrderCatalogs() {
  // Los desplegables no pueden ofrecer activos ni personal de otro buque.
  const orgId = await getActiveOrgId();
  const [assetList, techList, modeList] = await Promise.all([
    db
      .select({ id: assets.id, tag: assets.tag, name: assets.name })
      .from(assets)
      .where(eq(assets.organizationId, orgId))
      .orderBy(asc(assets.tag)),
    db
      .select({
        id: technicians.id,
        name: technicians.name,
        specialty: technicians.specialty,
      })
      .from(technicians)
      .where(and(eq(technicians.active, true), eq(technicians.organizationId, orgId)))
      .orderBy(asc(technicians.name)),
    db
      .select({
        id: failureModes.id,
        name: failureModes.name,
        category: failureModes.category,
      })
      .from(failureModes)
      .where(eq(failureModes.organizationId, orgId))
      .orderBy(asc(failureModes.code)),
  ]);

  return { assets: assetList, technicians: techList, failureModes: modeList };
}
