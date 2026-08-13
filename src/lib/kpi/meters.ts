/**
 * Horómetros: ritmo de uso y vencimiento de rutinas preventivas.
 *
 * El mantenimiento marino se programa por horas de marcha, no por calendario.
 * Pero al planificador no le sirve saber "vence a las 12.500 h" — necesita
 * saber **en qué fecha** va a pasar eso, para conseguir repuestos y ventana de
 * trabajo antes. Ese puente entre horas y fechas es lo que resuelve este módulo.
 *
 * Todo es puro y testeable: el juicio del modelo se apoya en estas cifras, no
 * las produce.
 */

const DAY_MS = 86_400_000;

export type Reading = {
  hours: number;
  takenAt: Date;
};

/**
 * Ritmo de uso en horas de marcha por día, a partir de las lecturas recientes.
 *
 * Se calcula sobre la primera y la última lectura de la ventana y no como
 * promedio de tramos: un buque alterna travesía y puerto, y promediar tramos
 * cortos amplifica el ruido de una lectura tomada con un día de desfase.
 *
 * Devuelve `null` si no hay dos lecturas suficientemente separadas — es mejor
 * no dar un ritmo que dar uno inventado sobre dos horas de diferencia.
 */
export function runRatePerDay(
  readings: readonly Reading[],
  windowDays = 90,
): number | null {
  if (readings.length < 2) return null;

  const sorted = [...readings].sort(
    (a, b) => a.takenAt.getTime() - b.takenAt.getTime(),
  );
  const last = sorted.at(-1)!;
  const cutoff = last.takenAt.getTime() - windowDays * DAY_MS;

  // Primera lectura dentro de la ventana. Si la única que cae dentro es la
  // última, se retrocede a la anterior: en un buque las lecturas pueden estar
  // muy espaciadas, y no dar ritmo sería peor que usar un dato algo viejo.
  let firstIndex = sorted.findIndex((r) => r.takenAt.getTime() >= cutoff);
  if (firstIndex === -1 || firstIndex === sorted.length - 1) {
    firstIndex = sorted.length - 2;
  }
  const first = sorted[firstIndex];
  if (first === last) return null;

  const elapsedDays = (last.takenAt.getTime() - first.takenAt.getTime()) / DAY_MS;
  if (elapsedDays < 1) return null;

  const deltaHours = last.hours - first.hours;
  // Un horómetro no retrocede: un delta negativo es reemplazo de instrumento o
  // error de tecleo, y proyectar sobre eso daría fechas absurdas.
  if (deltaHours < 0) return null;

  const rate = deltaHours / elapsedDays;
  // Más de 24 h de marcha por día es físicamente imposible.
  if (rate > 24) return null;

  return Math.round(rate * 100) / 100;
}

/** Lectura más reciente, o `null` si el activo no tiene ninguna. */
export function latestReading(readings: readonly Reading[]): Reading | null {
  if (readings.length === 0) return null;
  return [...readings].sort(
    (a, b) => b.takenAt.getTime() - a.takenAt.getTime(),
  )[0];
}

/**
 * Proyecta la fecha en que el horómetro alcanzará `targetHours`.
 * `null` si no hay ritmo conocido o el equipo está detenido (ritmo 0): sin uso
 * la rutina por horas no vence nunca, y decir "en 900 días" sería teatro.
 */
export function projectDate(
  currentHours: number,
  targetHours: number,
  ratePerDay: number | null,
  from: Date = new Date(),
): Date | null {
  if (ratePerDay === null || ratePerDay <= 0) return null;
  const remaining = targetHours - currentHours;
  if (remaining <= 0) return from;
  return new Date(from.getTime() + (remaining / ratePerDay) * DAY_MS);
}

export type PmTrigger = "calendario" | "horas" | "ambos";

export type PmPlanInput = {
  trigger: PmTrigger;
  nextDueAt: Date | null;
  nextDueHours: number | null;
};

export type PmStatus = {
  /** Ya vencida. */
  overdue: boolean;
  /** Qué condición manda: la que vence primero. */
  drivenBy: "calendario" | "horas" | null;
  /** Horas de marcha restantes, si aplica. */
  remainingHours: number | null;
  /** Días restantes según la condición que manda. */
  remainingDays: number | null;
  /** Fecha estimada de vencimiento — lo que el planificador necesita. */
  dueDate: Date | null;
};

/**
 * Estado de una rutina, resolviendo la regla marina habitual: cuando la rutina
 * va por horas **y** por calendario, vence lo que llegue primero.
 */
export function pmStatus(
  plan: PmPlanInput,
  currentHours: number | null,
  ratePerDay: number | null,
  now: Date = new Date(),
): PmStatus {
  const byCalendar =
    (plan.trigger === "calendario" || plan.trigger === "ambos") && plan.nextDueAt
      ? plan.nextDueAt
      : null;

  const hoursApply =
    (plan.trigger === "horas" || plan.trigger === "ambos") &&
    plan.nextDueHours !== null &&
    currentHours !== null;

  const remainingHours = hoursApply
    ? Math.round((plan.nextDueHours! - currentHours!) * 10) / 10
    : null;

  const byHours = hoursApply
    ? projectDate(currentHours!, plan.nextDueHours!, ratePerDay, now)
    : null;

  // Vencida por horas es un hecho, no una proyección: no depende del ritmo.
  const overdueByHours = remainingHours !== null && remainingHours <= 0;
  const overdueByCalendar = byCalendar !== null && byCalendar.getTime() <= now.getTime();

  let drivenBy: PmStatus["drivenBy"] = null;
  let dueDate: Date | null = null;

  if (overdueByHours && overdueByCalendar) {
    // Ambas vencidas: manda la que venció primero.
    drivenBy = byCalendar!.getTime() <= now.getTime() && byHours === null ? "calendario" : "horas";
    dueDate = byCalendar;
  } else if (overdueByHours) {
    drivenBy = "horas";
    dueDate = now;
  } else if (overdueByCalendar) {
    drivenBy = "calendario";
    dueDate = byCalendar;
  } else if (byHours && byCalendar) {
    // Ninguna vencida: manda la que llegue primero.
    const hoursFirst = byHours.getTime() <= byCalendar.getTime();
    drivenBy = hoursFirst ? "horas" : "calendario";
    dueDate = hoursFirst ? byHours : byCalendar;
  } else if (byHours) {
    drivenBy = "horas";
    dueDate = byHours;
  } else if (byCalendar) {
    drivenBy = "calendario";
    dueDate = byCalendar;
  } else if (hoursApply) {
    // Rutina por horas con el equipo detenido: no vence, pero se sabe cuánto falta.
    drivenBy = "horas";
  }

  const remainingDays =
    dueDate === null
      ? null
      : Math.round(((dueDate.getTime() - now.getTime()) / DAY_MS) * 10) / 10;

  return {
    overdue: overdueByHours || overdueByCalendar,
    drivenBy,
    remainingHours,
    remainingDays,
    dueDate,
  };
}

/** Cadencia siguiente tras ejecutar una rutina. */
export function advancePlan(
  plan: {
    trigger: PmTrigger;
    frequencyDays: number | null;
    frequencyHours: number | null;
  },
  executedAt: Date,
  executedHours: number | null,
): { nextDueAt: Date | null; nextDueHours: number | null } {
  const nextDueAt =
    (plan.trigger === "calendario" || plan.trigger === "ambos") &&
    plan.frequencyDays
      ? new Date(executedAt.getTime() + plan.frequencyDays * DAY_MS)
      : null;

  const nextDueHours =
    (plan.trigger === "horas" || plan.trigger === "ambos") &&
    plan.frequencyHours &&
    executedHours !== null
      ? Math.round((executedHours + plan.frequencyHours) * 10) / 10
      : null;

  return { nextDueAt, nextDueHours };
}
