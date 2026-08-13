/**
 * Detección de fallas repetitivas: la parte aritmética.
 *
 * Un patrón repetitivo es el mismo modo de falla en el mismo activo más de una
 * vez. Lo que importa no es solo cuántas veces, sino **si los intervalos se
 * están acortando**: un equipo que falla cada 90, 60, 30 días está degradándose,
 * y ese es el caso que justifica un análisis de causa raíz.
 *
 * Todo aquí es puro y testeable. La IA (rca.ts) interpreta estas cifras; no las
 * calcula.
 */

const DAY_MS = 86_400_000;

/** Intervalos en días entre eventos consecutivos, en orden cronológico. */
export function intervalsInDays(dates: readonly Date[]): number[] {
  if (dates.length < 2) return [];
  const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
  const out: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    out.push((sorted[i].getTime() - sorted[i - 1].getTime()) / DAY_MS);
  }
  return out;
}

/** Intervalo medio entre fallas. `null` si no hay al menos dos eventos. */
export function meanIntervalDays(dates: readonly Date[]): number | null {
  const intervals = intervalsInDays(dates);
  if (intervals.length === 0) return null;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  return Math.round(mean * 10) / 10;
}

export type RecurrenceTrend =
  | "acelerando"
  | "estable"
  | "desacelerando"
  | "indeterminada";

/**
 * Compara el intervalo medio de la primera mitad de la serie contra la segunda.
 * Si la segunda mitad es sensiblemente más corta, las fallas se aceleran.
 *
 * Hacen falta al menos 4 eventos (3 intervalos): con menos, cualquier variación
 * es ruido y devolvemos "indeterminada" en vez de fingir una tendencia.
 */
export function recurrenceTrend(
  dates: readonly Date[],
  /** Cambio relativo mínimo para no considerarlo estable. */
  threshold = 0.25,
): RecurrenceTrend {
  const intervals = intervalsInDays(dates);
  if (intervals.length < 3) return "indeterminada";

  const mid = Math.floor(intervals.length / 2);
  const first = intervals.slice(0, mid);
  const second = intervals.slice(intervals.length - mid);

  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const before = avg(first);
  const after = avg(second);
  if (before === 0) return "indeterminada";

  const change = (after - before) / before;
  if (change <= -threshold) return "acelerando";
  if (change >= threshold) return "desacelerando";
  return "estable";
}

/**
 * Próxima falla esperada, proyectando el intervalo medio desde la última.
 * Es una referencia de planificación, no una predicción: sin un modelo de
 * confiabilidad ajustado, proyectar la media es lo único honesto que se puede
 * hacer con estos datos.
 */
export function nextExpectedFailure(dates: readonly Date[]): Date | null {
  const mean = meanIntervalDays(dates);
  if (mean === null) return null;
  const last = [...dates].sort((a, b) => a.getTime() - b.getTime()).at(-1)!;
  return new Date(last.getTime() + mean * DAY_MS);
}

export type ChronicityBand = "cronica" | "recurrente" | "aislada";

/**
 * Clasifica el patrón por su impacto acumulado, no solo por frecuencia:
 * tres fallas de diez minutos no son lo mismo que tres de ocho horas.
 */
export function chronicityBand(
  occurrences: number,
  downtimeHours: number,
): ChronicityBand {
  if (occurrences >= 4 || (occurrences >= 3 && downtimeHours >= 24)) {
    return "cronica";
  }
  if (occurrences >= 2) return "recurrente";
  return "aislada";
}

/**
 * Prioriza qué patrón analizar primero: frecuencia × impacto, con un empujón
 * si la tendencia se está acelerando. Escala 0–100.
 */
export function recurrencePriority(input: {
  occurrences: number;
  downtimeHours: number;
  trend: RecurrenceTrend;
  criticality: "A" | "B" | "C";
}): number {
  const frequency = Math.min(30, input.occurrences * 7);
  const impact = Math.min(35, input.downtimeHours * 1.2);
  const criticality = { A: 25, B: 14, C: 5 }[input.criticality] ?? 5;
  const trend = input.trend === "acelerando" ? 10 : 0;

  const score = frequency + impact + criticality + trend;
  return Math.round(Math.min(100, score) * 10) / 10;
}
