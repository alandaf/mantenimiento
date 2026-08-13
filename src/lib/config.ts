/**
 * Configuración regional de la instalación.
 *
 * La moneda no puede estar cableada: la misma aplicación se despliega para
 * plantas en Chile, Perú u otros mercados, y un reporte con la moneda
 * equivocada no es un detalle cosmético — es un reporte inservible.
 *
 * Se lee del entorno una sola vez, al arrancar.
 */

/** Cae al valor por defecto también con cadena vacía, que es lo que inyecta compose. */
function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

export const LOCALE = env("APP_LOCALE", "es-CL");
export const CURRENCY = env("APP_CURRENCY", "CLP").toUpperCase();

/**
 * Monedas sin subunidad de uso corriente. Mostrar "CLP 1.234,00" en Chile o
 * "¥1,234.00" en Japón delata que el sistema no es de allí.
 */
const ZERO_DECIMAL = new Set(["CLP", "JPY", "KRW", "PYG", "ISK", "COP", "VND"]);

export const CURRENCY_DECIMALS = ZERO_DECIMAL.has(CURRENCY) ? 0 : 2;

/** Formateador de moneda único para toda la aplicación. */
export const money = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  maximumFractionDigits: 0,
});

/** Con decimales, para importes unitarios donde el redondeo se nota. */
export const moneyPrecise = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: CURRENCY_DECIMALS,
  maximumFractionDigits: CURRENCY_DECIMALS,
});

/**
 * Símbolo de la moneda, derivado del propio formateador en lugar de una tabla
 * que habría que mantener. Sirve para etiquetas de formulario: "Costo (CLP $)".
 */
export const CURRENCY_SYMBOL = (() => {
  const part = money
    .formatToParts(0)
    .find((p) => p.type === "currency");
  return part?.value ?? CURRENCY;
})();

/** Nombre de la moneda para instruir al modelo, que escribe prosa, no cifras. */
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

export const CURRENCY_NAME = CURRENCY_NAMES[CURRENCY] ?? CURRENCY;

/** Ejemplo formateado, para que el modelo copie el formato exacto. */
export const CURRENCY_EXAMPLE = money.format(1_250_000);

export const dateFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

export const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

export const longDateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: "long",
  timeStyle: "short",
});
