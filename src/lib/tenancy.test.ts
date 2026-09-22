import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { hasRole, isSuperadmin, ROLES, SUPERADMIN, type Role } from "@/lib/roles";

/**
 * Aislamiento entre instalaciones y permisos.
 *
 * Esto estaba verificado a mano —escribiendo peticiones y comprobando que un
 * buque no veía los datos de otro— pero no había nada que lo sostuviera. Una
 * consulta nueva a la que se le olvide el filtro pasa todas las demás pruebas,
 * arranca sin errores y filtra los datos de un cliente al siguiente.
 *
 * Son pruebas estáticas a propósito: no necesitan base de datos y corren en
 * milisegundos, así que nadie tiene excusa para saltárselas.
 */

const RAIZ = path.resolve(__dirname, "..");

/** Tablas que guardan datos de un cliente y por tanto deben estar separadas. */
const TABLAS_DE_DOMINIO = [
  "assets",
  "work_orders",
  "pm_plans",
  "meter_readings",
  "failure_modes",
  "technicians",
  "ai_insights",
  "settings",
  "pm_tasks",
  "work_order_tasks",
  "measurements",
  "work_order_materials",
  "audit_log",
  "attachments",
] as const;

/** Las mismas tablas, con el nombre que usa el constructor de consultas. */
const VARIABLES_DE_DOMINIO = [
  "assets", "workOrders", "pmPlans", "meterReadings", "failureModes", "technicians",
  "aiInsights", "settings", "pmTasks", "workOrderTasks", "measurements",
  "workOrderMaterials", "auditLog", "attachments",
];

/**
 * Consultas del constructor que no necesitan filtro propio, con el motivo.
 * Añadir una aquí es una decisión: debe poder defenderse en una línea.
 */
const EXCEPCIONES_CONSTRUCTOR: Record<string, string> = {
  // Recibe una orden ya verificada como propia por quien la llama (el cierre),
  // y sigue sus claves foráneas dentro de la misma transacción.
  [path.join("lib", "actions", "advance-plan.ts")]: "orden verificada por el llamador",
};

function archivosTs(dir: string): string[] {
  const salida: string[] = [];
  for (const entrada of readdirSync(dir)) {
    const completo = path.join(dir, entrada);
    if (statSync(completo).isDirectory()) {
      salida.push(...archivosTs(completo));
    } else if (/\.tsx?$/.test(entrada) && !/\.test\.tsx?$/.test(entrada)) {
      salida.push(completo);
    }
  }
  return salida;
}

/** Extrae cada plantilla sql`…` de un archivo. */
function consultasDe(contenido: string): string[] {
  const consultas: string[] = [];
  const marca = "sql`";
  let i = contenido.indexOf(marca);
  while (i !== -1) {
    const inicio = i + marca.length;
    const fin = contenido.indexOf("`", inicio);
    if (fin === -1) break;
    consultas.push(contenido.slice(inicio, fin));
    i = contenido.indexOf(marca, fin);
  }
  return consultas;
}

describe("separación de datos por instalación", () => {
  it("toda tabla de dominio declara organization_id obligatorio", () => {
    const sinColumna: string[] = [];

    for (const [nombre, tabla] of Object.entries(schema)) {
      // Solo las tablas de dominio; las de autenticación las gestiona
      // better-auth con su propio modelo.
      // `schema` exporta tablas, tipos y objetos de relaciones mezclados. Se
      // mira la forma interna de drizzle y se descarta todo lo que no la tenga.
      const columnas = (tabla as unknown as Record<string, unknown>)?.["_"] as
        | { columns?: Record<string, { notNull?: boolean }>; name?: string }
        | undefined;
      if (!columnas?.columns || !columnas.name) continue;
      if (!TABLAS_DE_DOMINIO.includes(columnas.name as never)) continue;

      const org = columnas.columns["organizationId"];
      if (!org || org.notNull !== true) sinColumna.push(`${nombre} (${columnas.name})`);
    }

    // Si esto falla, alguien añadió una tabla de datos de cliente sin la
    // columna que la separa del resto.
    expect(sinColumna).toEqual([]);
  });

  it("toda consulta a una tabla de dominio filtra por organization_id", () => {
    const infractoras: string[] = [];

    for (const archivo of archivosTs(RAIZ)) {
      const contenido = readFileSync(archivo, "utf8");
      for (const consulta of consultasDe(contenido)) {
        const normalizada = consulta.toLowerCase();

        // Solo las que leen o escriben tablas de dominio.
        const tocaDominio = TABLAS_DE_DOMINIO.some((t) =>
          new RegExp(`\\b${t}\\b`).test(normalizada),
        );
        if (!tocaDominio) continue;

        // Una subconsulta correlacionada hereda el filtro del exterior, y un
        // TRUNCATE del seed no filtra por definición: ambos se reconocen por
        // no ser consultas completas o por estar fuera de la aplicación.
        if (/^\s*(truncate|create|alter|drop)/.test(normalizada)) continue;
        if (archivo.includes(`${path.sep}db${path.sep}`)) continue;

        if (!normalizada.includes("organization_id")) {
          infractoras.push(
            `${path.relative(RAIZ, archivo)} → ${consulta.trim().slice(0, 70).replace(/\s+/g, " ")}…`,
          );
        }
      }
    }

    // Si esto falla, hay una consulta que devuelve datos de todas las
    // instalaciones a la vez.
    expect(infractoras).toEqual([]);
  });

  it("toda consulta del constructor a una tabla de dominio filtra por instalación", () => {
    // La prueba anterior solo ve las consultas escritas con sql`…`. Esta cubre
    // las de `.from(tabla)`, `.update(tabla)` y `.delete(tabla)`, que es donde
    // se coló el análisis de priorización de una planta mostrado en otra.
    const infractoras: string[] = [];
    const patron = new RegExp(`\\.(from|update|delete)\\((${VARIABLES_DE_DOMINIO.join("|")})\\)`, "g");

    for (const archivo of archivosTs(RAIZ)) {
      const relativo = path.relative(RAIZ, archivo);
      if (EXCEPCIONES_CONSTRUCTOR[relativo]) continue;
      if (archivo.includes(`${path.sep}db${path.sep}`)) continue;

      const contenido = readFileSync(archivo, "utf8");
      for (const m of contenido.matchAll(patron)) {
        // La sentencia termina en el primer `;` de fin de línea.
        const resto = contenido.slice(m.index! + m[0].length, m.index! + m[0].length + 900);
        const sentencia = resto.split(/;\s*\n/)[0];
        if (!/organizationId|orgId/.test(sentencia)) {
          const linea = contenido.slice(0, m.index).split("\n").length;
          infractoras.push(`${relativo}:${linea} → ${m[0]}`);
        }
      }
    }

    expect(infractoras).toEqual([]);
  });
});

describe("roles y permisos", () => {
  const roles = Object.keys(ROLES) as Role[];

  it("la jerarquía es consistente en toda la matriz", () => {
    const rango: Record<Role, number> = {
      admin: 5,
      jefe: 4,
      planificador: 3,
      tecnico: 2,
      lectura: 1,
    };

    for (const actual of roles) {
      for (const minimo of roles) {
        expect(hasRole(actual, minimo)).toBe(rango[actual] >= rango[minimo]);
      }
    }
  });

  it("un rol desconocido no obtiene ningún permiso", () => {
    expect(hasRole("inventado", "lectura")).toBe(false);
    expect(hasRole("superadministrador", "lectura")).toBe(false);
  });

  it("una cuenta sin rol se trata como solo lectura, no como sin acceso", () => {
    // Es deliberado: el rol por defecto de better-auth es `lectura`, y una
    // cuenta recién creada a la que le falte el campo debe poder consultar,
    // nunca modificar. Lo que no puede es escalar.
    expect(hasRole(null, "lectura")).toBe(true);
    expect(hasRole(undefined, "lectura")).toBe(true);
    expect(hasRole(null, "tecnico")).toBe(false);
    expect(hasRole(undefined, "admin")).toBe(false);
  });

  it("el operador de plataforma NO está en la lista de roles asignables", () => {
    // El esquema que valida el alta de usuarios se construye sobre ROLES. Si
    // superadmin apareciera aquí, un administrador de buque podría asignárselo
    // a sí mismo desde la pantalla de usuarios.
    expect(roles).not.toContain(SUPERADMIN);
    expect(Object.keys(ROLES)).not.toContain("superadmin");
  });

  it("superadmin no hereda permisos de la jerarquía del buque", () => {
    // No está en la escalera: su acceso viene de requireSuperadmin, no de
    // hasRole. Si algún día heredara, entraría a las pantallas de una
    // instalación a la que no pertenece.
    expect(hasRole(SUPERADMIN, "lectura")).toBe(false);
    expect(hasRole(SUPERADMIN, "admin")).toBe(false);
    expect(isSuperadmin(SUPERADMIN)).toBe(true);
    expect(isSuperadmin("admin")).toBe(false);
  });
});
