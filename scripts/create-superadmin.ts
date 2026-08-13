/**
 * Crea el operador de la plataforma.
 *
 * Es el único arranque en frío que queda: una vez existe esta cuenta, las
 * instalaciones y sus administradores se dan de alta desde /plataforma sin
 * volver a tocar el servidor.
 *
 *   pnpm tsx scripts/create-superadmin.ts "Andrés Landa" andres@simarp.cl "clave-larga"
 */
import { eq } from "drizzle-orm";
import { db, sqlClient } from "../src/db";
import { user } from "../src/db/schema";
import { auth } from "../src/lib/auth";
import { SUPERADMIN } from "../src/lib/roles";

async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error(
      'Uso: pnpm tsx scripts/create-superadmin.ts "Nombre Apellido" correo@dominio.cl "contraseña"',
    );
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("La contraseña necesita al menos 10 caracteres.");
    process.exit(1);
  }

  const normalized = email.trim().toLowerCase();
  const [existing] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  if (existing) {
    console.error(`Ya existe una cuenta con el correo ${normalized}.`);
    process.exit(1);
  }

  const ctx = await auth.$context;

  // Sin fila en `member`: el operador no pertenece a ninguna instalación, y esa
  // ausencia es justamente lo que le impide ver los datos de un cliente.
  const created = await ctx.internalAdapter.createUser({
    name,
    email: normalized,
    emailVerified: true,
    role: SUPERADMIN,
  });

  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(password),
  });

  console.log(`
✔ Operador de plataforma creado
  ${name} <${normalized}>

  Entra en /login y da de alta las instalaciones desde /plataforma.
`);
}

main()
  .catch((err) => {
    console.error("✖ No se pudo crear el operador:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
