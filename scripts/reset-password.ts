/**
 * Restablece la contraseña de una cuenta desde el servidor.
 *
 * Es la vía de rescate que faltaba. Dentro de la aplicación un administrador
 * puede restablecer la de su tripulación, pero nadie puede restablecer la del
 * operador de la plataforma —está por encima de todos— ni la del único
 * administrador de una instalación si se queda fuera. Sin esto, esa cuenta se
 * recuperaba editando la base a mano, que es justo donde se cometen errores
 * caros.
 *
 *   pnpm tsx scripts/reset-password.ts correo@dominio.cl "contraseña-larga"
 *
 * Sin contraseña genera una al azar y la imprime: es preferible a que alguien
 * elija "Verano2026" con prisa.
 */
import { eq, sql } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, sqlClient } from "../src/db";
import { account, user } from "../src/db/schema";
import { auth } from "../src/lib/auth";

/** Sin caracteres ambiguos: nadie quiere distinguir O de 0 al dictarla. */
function generar(): string {
  const alfabeto = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(20);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

async function main() {
  const [email, passwordArg] = process.argv.slice(2);

  if (!email) {
    console.error(
      'Uso: pnpm tsx scripts/reset-password.ts correo@dominio.cl ["contraseña"]',
    );
    process.exit(1);
  }
  if (passwordArg && passwordArg.length < 10) {
    console.error("La contraseña necesita al menos 10 caracteres.");
    process.exit(1);
  }

  const normalized = email.trim().toLowerCase();
  const [cuenta] = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(eq(user.email, normalized))
    .limit(1);

  if (!cuenta) {
    console.error(`No existe una cuenta con el correo ${normalized}.`);
    process.exit(1);
  }

  const password = passwordArg ?? generar();
  const ctx = await auth.$context;
  const hash = await ctx.password.hash(password);

  // La contraseña vive en la cuenta de tipo "credential", no en el usuario.
  const actualizadas = await db
    .update(account)
    .set({ password: hash })
    .where(eq(account.userId, cuenta.id))
    .returning({ id: account.id });

  if (actualizadas.length === 0) {
    // Cuenta sin credencial: existe el usuario pero nunca se le enlazó una
    // contraseña. Se enlaza ahora en vez de fallar.
    await ctx.internalAdapter.linkAccount({
      userId: cuenta.id,
      providerId: "credential",
      accountId: cuenta.id,
      password: hash,
    });
  }

  // Las sesiones abiertas se cierran: si se restablece porque la cuenta estaba
  // comprometida, dejarlas vivas no arreglaría nada.
  const cerradas = (await db.execute(
    sql`DELETE FROM session WHERE user_id = ${cuenta.id} RETURNING id`,
  )) as unknown as Array<{ id: string }>;

  console.log(`
✔ Contraseña restablecida
  ${cuenta.name} <${normalized}>  ·  rol: ${cuenta.role ?? "—"}
  Sesiones cerradas: ${cerradas.length}
`);

  if (!passwordArg) {
    console.log(`  Contraseña nueva:  ${password}\n`);
  }
  console.log("  Entra y cámbiala desde /perfil.\n");
}

main()
  .catch((err) => {
    console.error("✖ No se pudo restablecer la contraseña:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
