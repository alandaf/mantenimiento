/**
 * Siembra datos de demostración en UNA instalación.
 *
 * A diferencia de `db:seed`, que vacía las tablas y rehace la flota entera,
 * esto es lo único que puede ejecutarse en un servidor con clientes reales: no
 * borra nada de nadie.
 *
 *   pnpm tsx scripts/seed-demo.ts <slug> <dataset> ["Nombre visible"]
 *   pnpm tsx scripts/seed-demo.ts minera-cerro-bayo minera "Minera Cerro Bayo"
 *
 * Datasets: industrial · marino · granelero · minera · remolcador
 */
import { sql } from "drizzle-orm";
import { db, sqlClient } from "../src/db";
import { settings } from "../src/db/schema";
import { DATASETS, seed } from "../src/db/seed";

async function main() {
  const [slug, datasetKey, nombreArg] = process.argv.slice(2);
  const dataset = datasetKey ? DATASETS[datasetKey.toLowerCase()] : undefined;

  if (!slug || !dataset) {
    console.error(
      'Uso: pnpm tsx scripts/seed-demo.ts <slug> <dataset> ["Nombre visible"]',
    );
    console.error(`Datasets: ${Object.keys(DATASETS).join(" · ")}`);
    process.exit(1);
  }

  const nombre = nombreArg?.trim() || dataset.root.name;

  const [org] = (await db.execute(sql`
    INSERT INTO organization (id, name, slug, created_at)
    VALUES (${crypto.randomUUID()}, ${nombre}, ${slug}, now())
    ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
    RETURNING id
  `)) as unknown as Array<{ id: string }>;

  // Sembrar dos veces duplicaría activos y órdenes en vez de reemplazarlos, y
  // los KPI quedarían al doble sin que nada lo delate. Mejor negarse.
  const [{ activos }] = (await db.execute(sql`
    SELECT COUNT(*)::int AS activos FROM assets WHERE organization_id = ${org.id}
  `)) as unknown as Array<{ activos: number }>;

  if (activos > 0) {
    console.error(
      `✖ "${slug}" ya tiene ${activos} activos. Sembrar encima los duplicaría.`,
    );
    console.error("  Si quieres rehacerla, borra antes sus datos a conciencia.");
    process.exit(1);
  }

  await db
    .insert(settings)
    .values({
      organizationId: org.id,
      installationName: nombre,
      currency: "CLP",
      locale: "es-CL",
    })
    .onConflictDoNothing();

  await seed(dataset, org.id, nombre);

  console.log(`
✔ ${nombre} sembrada con el set "${datasetKey}".
  Asígnale un administrador desde /plataforma.
`);
}

main()
  .catch((err) => {
    console.error("✖ No se pudo sembrar:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
