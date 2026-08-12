/**
 * Fórmulas de confiabilidad. Funciones puras, sin acceso a BD, para que sean
 * verificables con tests unitarios: si un KPI está mal, el taller entero pierde
 * sentido. Todas las duraciones se manejan en HORAS.
 *
 * Referencia: SMRP Best Practices Metrics 5.1.x / ISO 14224.
 */

/**
 * MTTR — Mean Time To Repair.
 * Promedio del tiempo activo de reparación de las intervenciones correctivas.
 *
 *     MTTR = Σ(fin − inicio) / nº de correctivas cerradas
 *
 * Devuelve `null` si no hubo correctivas: un MTTR de 0 significaría
 * "se repara instantáneamente", que es falso y distorsiona la disponibilidad.
 */
export function mttr(totalRepairHours: number, repairCount: number): number | null {
  if (repairCount <= 0) return null;
  return totalRepairHours / repairCount;
}

/**
 * MTBF — Mean Time Between Failures.
 * Solo cuenta tiempo en el que el activo **pudo** fallar, es decir tiempo
 * operativo, no tiempo calendario. Este es el error más común al calcularlo.
 *
 *     MTBF = horas operativas / nº de fallas
 */
export function mtbf(operatingHours: number, failureCount: number): number | null {
  if (failureCount <= 0) return null;
  if (operatingHours < 0) throw new RangeError("operatingHours no puede ser negativo");
  return operatingHours / failureCount;
}

/**
 * Disponibilidad inherente, derivada de MTBF y MTTR.
 *
 *     A = MTBF / (MTBF + MTTR)
 *
 * Sin fallas registradas la disponibilidad inherente es 1 (100%).
 */
export function inherentAvailability(
  mtbfHours: number | null,
  mttrHours: number | null,
): number | null {
  if (mtbfHours === null) return mttrHours === null ? 1 : null;
  if (mttrHours === null) return 1;
  const denominator = mtbfHours + mttrHours;
  if (denominator === 0) return null;
  return mtbfHours / denominator;
}

/**
 * Disponibilidad operacional: la que ve producción. Mide parada real contra
 * tiempo calendario, incluyendo esperas de repuesto y de personal.
 *
 *     Ao = (calendario − parada) / calendario
 */
export function operationalAvailability(
  calendarHours: number,
  downtimeHours: number,
): number | null {
  if (calendarHours <= 0) return null;
  const uptime = Math.max(0, calendarHours - downtimeHours);
  return Math.min(1, uptime / calendarHours);
}

/**
 * Cumplimiento del plan preventivo (PMP compliance).
 * Preventivas ejecutadas dentro de ventana / preventivas programadas.
 */
export function pmCompliance(executedOnTime: number, scheduled: number): number | null {
  if (scheduled <= 0) return null;
  return Math.min(1, executedOnTime / scheduled);
}

/**
 * Proporción de trabajo correctivo sobre el total de horas ejecutadas.
 * Un valor alto (>30%) indica que el mantenimiento es reactivo.
 */
export function correctiveRatio(
  correctiveHours: number,
  totalHours: number,
): number | null {
  if (totalHours <= 0) return null;
  return correctiveHours / totalHours;
}

/**
 * Análisis de Pareto: ordena de mayor a menor y acumula el porcentaje.
 * Marca `isVital` los elementos que caen dentro del 80% acumulado — los
 * "pocos vitales" sobre los que hay que actuar primero.
 */
export function pareto<T extends { label: string; value: number }>(
  items: readonly T[],
): Array<T & { percentage: number; cumulative: number; isVital: boolean }> {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    return items.map((item) => ({
      ...item,
      percentage: 0,
      cumulative: 0,
      isVital: false,
    }));
  }

  const sorted = [...items].sort((a, b) => b.value - a.value);
  let running = 0;
  let vitalCutReached = false;

  return sorted.map((item) => {
    const percentage = (item.value / total) * 100;
    running += percentage;
    // El elemento que cruza el 80% se incluye; los siguientes ya no.
    const isVital = !vitalCutReached;
    if (running >= 80) vitalCutReached = true;
    return { ...item, percentage, cumulative: running, isVital };
  });
}

/** Convierte minutos a horas con 2 decimales, para presentación. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** Formatea una fracción 0–1 como porcentaje con 1 decimal. */
export function toPercent(fraction: number | null, decimals = 1): string {
  if (fraction === null || Number.isNaN(fraction)) return "—";
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Formatea horas de forma legible: 4.2 h, 256 h, 1.2k h. */
export function formatHours(hours: number | null): string {
  if (hours === null || Number.isNaN(hours)) return "—";
  if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k h`;
  if (hours >= 100) return `${Math.round(hours)} h`;
  return `${hours.toFixed(1)} h`;
}
