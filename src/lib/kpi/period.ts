export type Period = { from: Date; to: Date };

/** Horas calendario que abarca el periodo. */
export function calendarHours({ from, to }: Period): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}

/** Periodo por defecto del dashboard: últimos N días hasta ahora. */
export function lastDays(days: number): Period {
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  return { from, to };
}

/** Rango completo del mes indicado (0 = enero). */
export function monthPeriod(year: number, month: number): Period {
  return {
    from: new Date(Date.UTC(year, month, 1)),
    to: new Date(Date.UTC(year, month + 1, 1)),
  };
}

export function formatPeriod({ from, to }: Period): string {
  const fmt = new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${fmt.format(from)} — ${fmt.format(to)}`;
}
