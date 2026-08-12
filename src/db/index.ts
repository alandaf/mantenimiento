import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL en el entorno");
}

// En dev, Next recarga los módulos en cada cambio; sin este singleton se
// abriría un pool nuevo por recarga hasta agotar las conexiones de Postgres.
const globalForDb = globalThis as unknown as {
  sqlClient?: ReturnType<typeof postgres>;
};

export const sqlClient =
  globalForDb.sqlClient ?? postgres(connectionString, { max: 10 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sqlClient = sqlClient;
}

export const db = drizzle(sqlClient, { schema });
export { schema };
