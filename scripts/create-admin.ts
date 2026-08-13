/**
 * Crea la cuenta de administrador inicial de una instalación.
 *
 * Es un problema de arranque en frío: no hay registro público (`disableSignUp`)
 * y solo un admin puede crear cuentas, así que la primera tiene que nacer fuera
 * del flujo normal. Por eso se usa el contexto interno de better-auth en vez de
 * la API pública — que, correctamente, rechaza el alta.
 *
 *   pnpm tsx scripts/create-admin.ts "Rodrigo Vergara" jefe@naviera.cl "clave-larga"
 */
import { eq } from "drizzle-orm";
import { db, sqlClient } from "../src/db";
import { user } from "../src/db/schema";
import { auth } from "../src/lib/auth";

async function main() {
  const [name, email, password] = process.argv.slice(2);

  if (!name || !email || !password) {
    console.error(
      'Uso: pnpm tsx scripts/create-admin.ts "Nombre Apellido" correo@dominio.cl "contraseña"',
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

  const created = await ctx.internalAdapter.createUser({
    name,
    email: normalized,
    emailVerified: true,
    role: "admin",
  });

  // La contraseña vive en la cuenta de tipo "credential", no en el usuario.
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: "credential",
    accountId: created.id,
    password: await ctx.password.hash(password),
  });

  console.log(`
✔ Administrador creado
  ${name} <${normalized}>

  Entra en /login y cambia la contraseña cuanto antes.
`);
}

main()
  .catch((err) => {
    console.error("✖ No se pudo crear el administrador:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
