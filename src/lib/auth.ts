import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { db } from "@/db";
import { ac, roles } from "./permissions";

/**
 * Autenticación por correo y contraseña.
 *
 * Se eligió correo/contraseña sobre OAuth por el contexto de uso: a bordo la
 * conectividad es intermitente y un flujo OAuth contra un proveedor externo
 * puede quedar colgado. Además el Jefe de Máquinas necesita poder crear la
 * cuenta del cadete que embarca mañana sin depender de TI en tierra.
 *
 * Una **organización** es una instalación: un buque o una planta. El admin de
 * esa organización administra su propia gente y no ve la de otra. Esto también
 * deja preparado el terreno para multi-inquilino sin reescribir nada.
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),

  emailAndPassword: {
    enabled: true,
    // No hay registro público: las cuentas las crea el admin de la instalación.
    disableSignUp: true,
    minPasswordLength: 10,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  plugins: [
    organization({
      // Una persona pertenece a una instalación; si rota de buque, se la agrega
      // a la nueva. Permitir crear organizaciones desde la app sería un error:
      // dar de alta un buque es una decisión comercial, no de un usuario.
      allowUserToCreateOrganization: false,
      organizationLimit: 1,
    }),
    admin({
      ac,
      roles,
      adminRoles: ["admin"],
      defaultRole: "lectura",
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
