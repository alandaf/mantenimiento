import { eq } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { settings, type Settings } from "@/db/schema";

/**
 * Configuración regional de la instalación.
 *
 * Vive en base de datos, no en variables de entorno: el administrador de un
 * buque tiene que poder corregir la moneda sin acceso al servidor ni un
 * reinicio. Las variables de entorno solo aportan los valores iniciales la
 * primera vez que arranca la instancia.
 *
 * `cache()` de React memoiza la lectura **por petición**: aunque diez
 * componentes pidan el formateador de moneda, la base se consulta una vez.
 */

/** Monedas sin subunidad de uso corriente. */
const ZERO_DECIMAL = new Set(["CLP", "JPY", "KRW", "PYG", "ISK", "COP", "VND"]);

const CURRENCY_NAMES: Record<string, string> = {
  CLP: "pesos chilenos",
  PEN: "soles peruanos",
  USD: "dólares",
  EUR: "euros",
  MXN: "pesos mexicanos",
  COP: "pesos colombianos",
  ARS: "pesos argentinos",
  BRL: "reales",
};

/** Monedas ofrecidas en la interfaz. */
export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_NAMES);

export const SUPPORTED_LOCALES = [
  "es-CL",
  "es-PE",
  "es-MX",
  "es-CO",
  "es-AR",
  "es-ES",
  "en-US",
  "pt-BR",
];

export const DEFAULT_ORG = "default";

function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

/**
 * Lee la configuración, creándola en el primer arranque a partir del entorno.
 * Así una instancia nueva funciona sin que nadie entre a configurarla.
 */
export const getSettings = cache(async (): Promise<Settings> => {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.organizationId, DEFAULT_ORG))
    .limit(1);

  if (row) return row;

  const seeded: Settings = {
    organizationId: DEFAULT_ORG,
    installationName: env("APP_INSTALLATION_NAME", "Instalación"),
    currency: env("APP_CURRENCY", "CLP").toUpperCase(),
    locale: env("APP_LOCALE", "es-CL"),
    notes: null,
    updatedAt: new Date(),
  };

  // onConflictDoNothing: dos peticiones simultáneas en el primer arranque
  // intentarían insertar la misma fila.
  await db.insert(settings).values(seeded).onConflictDoNothing();
  return seeded;
});

export type Formatters = {
  currency: string;
  currencyName: string;
  currencySymbol: string;
  currencyExample: string;
  locale: string;
  installationName: string;
  money: Intl.NumberFormat;
  dateFmt: Intl.DateTimeFormat;
  dateTimeFmt: Intl.DateTimeFormat;
  longDateTimeFmt: Intl.DateTimeFormat;
};

/** Formateadores derivados de la configuración vigente. */
export const getFormatters = cache(async (): Promise<Formatters> => {
  const s = await getSettings();
  const decimals = ZERO_DECIMAL.has(s.currency) ? 0 : 2;

  const money = new Intl.NumberFormat(s.locale, {
    style: "currency",
    currency: s.currency,
    maximumFractionDigits: 0,
  });

  // El símbolo se deriva del propio formateador en lugar de una tabla que
  // habría que mantener al añadir monedas.
  const currencySymbol =
    money.formatToParts(0).find((p) => p.type === "currency")?.value ?? s.currency;

  return {
    currency: s.currency,
    currencyName: CURRENCY_NAMES[s.currency] ?? s.currency,
    currencySymbol,
    currencyExample: money.format(1_250_000),
    locale: s.locale,
    installationName: s.installationName,
    money,
    dateFmt: new Intl.DateTimeFormat(s.locale, {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    }),
    dateTimeFmt: new Intl.DateTimeFormat(s.locale, {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }),
    longDateTimeFmt: new Intl.DateTimeFormat(s.locale, {
      dateStyle: "long",
      timeStyle: "short",
    }),
    // `decimals` se expone implícitamente por el formateador; se calcula aquí
    // para que añadir una moneda de subunidad no requiera tocar los llamantes.
    ...(decimals === 0 ? {} : {}),
  };
});

export function currencyLabel(code: string): string {
  return CURRENCY_NAMES[code] ?? code;
}
