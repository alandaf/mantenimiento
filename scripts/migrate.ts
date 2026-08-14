/**
 * Aplica las migraciones pendientes.
 *
 * Corre al arrancar el contenedor de producción, antes de que la aplicación
 * acepte tráfico. Sustituye a `drizzle-kit push`, que compara el esquema con la
 * base y decide sobre la marcha qué alterar: cómodo mientras los datos son de
 * prueba y se pueden borrar, inaceptable con el histórico de una naviera dentro
 * —un `push` que decida recrear una columna es pérdida irreversible—.
 *
 *   pnpm db:migrate
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");
const SCHEMA = "drizzle";
const TABLE = "__drizzle_migrations";

/** Una tabla que solo existe si el esquema de la aplicación ya está aplicado. */
const SENTINEL = "work_orders";

type JournalEntry = { tag: string; when: number };

function readJournal(): JournalEntry[] {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta", "_journal.json");
  if (!fs.existsSync(journalPath)) return [];
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: JournalEntry[];
  };
  return journal.entries ?? [];
}

/**
 * Hash de una migración. Tiene que coincidir con el que calcula drizzle
 * —sha256 del contenido del archivo— o volvería a aplicarla.
 */
function hashOf(tag: string): string {
  const file = path.join(MIGRATIONS_FOLDER, `${tag}.sql`);
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL en el entorno.");
    process.exit(1);
  }

  // Conexión propia y de una sola sesión: el pool de la aplicación no tiene
  // por qué existir para migrar, y `max: 1` evita que dos conexiones intenten
  // aplicar la misma migración a la vez.
  // `onnotice` silenciado: drizzle crea su tabla de control con IF NOT EXISTS y
  // Postgres avisa cada vez que ya existía. En el log de un despliegue esos
  // avisos parecen un fallo, y esconden los que sí importan.
  const client = postgres(url, { max: 1, onnotice: () => {} });
  const db = drizzle(client);

  try {
    const entries = readJournal();
    if (entries.length === 0) {
      console.log("No hay migraciones que aplicar.");
      return;
    }

    const [{ applied }] = (await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = ${SCHEMA} AND table_name = ${TABLE}
      ) AS applied
    `)) as unknown as Array<{ applied: boolean }>;

    if (!applied) {
      const [{ present }] = (await db.execute(sql`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = ${SENTINEL}
        ) AS present
      `)) as unknown as Array<{ present: boolean }>;

      // Base preexistente: el esquema ya está, pero se creó con `push` y por eso
      // no hay registro de migraciones. Aplicar la inicial fallaría al crear
      // tablas que ya existen, así que se da por aplicada sin ejecutarla. Es el
      // paso de "adoptar" una base anterior al control de versiones; solo ocurre
      // una vez, y en una base nueva no se ejecuta nada de esto.
      if (present) {
        console.log(
          `→ Base preexistente detectada. Registrando ${entries.length} migración(es) como aplicadas sin ejecutarlas.`,
        );
        await db.execute(sql`CREATE SCHEMA IF NOT EXISTS ${sql.identifier(SCHEMA)}`);
        await db.execute(sql`
          CREATE TABLE IF NOT EXISTS ${sql.identifier(SCHEMA)}.${sql.identifier(TABLE)} (
            id SERIAL PRIMARY KEY,
            hash text NOT NULL,
            created_at bigint
          )
        `);
        for (const entry of entries) {
          await db.execute(sql`
            INSERT INTO ${sql.identifier(SCHEMA)}.${sql.identifier(TABLE)} (hash, created_at)
            VALUES (${hashOf(entry.tag)}, ${entry.when})
          `);
          console.log(`  · ${entry.tag} (registrada)`);
        }
        console.log("✔ Base adoptada. Las próximas migraciones sí se aplicarán.");
        return;
      }
    }

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("✔ Migraciones al día.");
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("✖ Fallaron las migraciones:", err);
  process.exit(1);
});
