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
import { sembrarAdjuntosGlp } from "../src/db/seeds/adjuntos-glp";

const ROLES_POR_DATASET: Record<string, Record<string, string>> = {
  glp: { jefe: "Jefe de Mantenimiento", tecnico: "Técnico de Mantenimiento" },
  minera: { jefe: "Jefe de Mantenimiento" },
  industrial: { jefe: "Jefe de Mantenimiento" },
};

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

  const rehacer = process.argv.includes("--rehacer");

  if (activos > 0 && !rehacer) {
    console.error(
      `✖ "${slug}" ya tiene ${activos} activos. Sembrar encima los duplicaría.`,
    );
    console.error("  Para rehacerla desde cero: añade --rehacer");
    process.exit(1);
  }

  if (activos > 0 && rehacer) {
    // Solo esta organización. Escribir los DELETE a mano contra producción cada
    // vez es justo lo que acaba borrando la instalación equivocada un día con
    // prisa; aquí el identificador se resuelve una vez y se reutiliza.
    console.log(`→ Borrando los datos actuales de "${slug}"…`);
    for (const tabla of [
      // Los documentos de la demo apuntan a activos y órdenes que se van a
      // borrar. Los archivos quedan en el disco; son pocos KB.
      "attachments",
      "work_orders",
      "pm_plans",
      "meter_readings",
      "ai_insights",
      "assets",
      "failure_modes",
      "technicians",
    ]) {
      await db.execute(
        sql`DELETE FROM ${sql.identifier(tabla)} WHERE organization_id = ${org.id}`,
      );
    }
    // Las cuentas y la membresía NO se tocan: rehacer la demo no puede dejar
    // sin instalación a quien ya tiene usuario.
  }

  // Nombres de rol de partida según el tipo de instalación. En tierra no hay
  // «Jefe de Máquinas». Solo se escriben si la instalación aún no tiene los
  // suyos: rehacer la demo no pisa lo que el administrador haya cambiado.
  const roleLabels = ROLES_POR_DATASET[datasetKey.toLowerCase()] ?? null;
  await db
    .insert(settings)
    .values({
      organizationId: org.id,
      installationName: nombre,
      currency: "CLP",
      locale: "es-CL",
      roleLabels,
    })
    .onConflictDoNothing();
  if (roleLabels) {
    await db.execute(sql`
      UPDATE settings SET role_labels = ${JSON.stringify(roleLabels)}::jsonb
      WHERE organization_id = ${org.id} AND role_labels IS NULL
    `);
  }

  await seed(dataset, org.id, nombre);
  if (datasetKey.toLowerCase() === "glp") await sembrarAdjuntosGlp(org.id);

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
