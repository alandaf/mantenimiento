import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { assets, failureModes, technicians } from "@/db/schema";

/** Catálogos que alimentan los selects del formulario de OT. */
export async function getWorkOrderCatalogs() {
  const [assetList, techList, modeList] = await Promise.all([
    db
      .select({ id: assets.id, tag: assets.tag, name: assets.name })
      .from(assets)
      .orderBy(asc(assets.tag)),
    db
      .select({
        id: technicians.id,
        name: technicians.name,
        specialty: technicians.specialty,
      })
      .from(technicians)
      .where(eq(technicians.active, true))
      .orderBy(asc(technicians.name)),
    db
      .select({
        id: failureModes.id,
        name: failureModes.name,
        category: failureModes.category,
      })
      .from(failureModes)
      .orderBy(asc(failureModes.code)),
  ]);

  return { assets: assetList, technicians: techList, failureModes: modeList };
}
