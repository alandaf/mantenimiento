import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getFormatters, type Formatters } from "@/lib/config";
import { formatHours, toPercent } from "@/lib/kpi/formulas";
import { getFailurePatterns } from "@/lib/kpi/patterns";
import { monthPeriod, type Period } from "@/lib/kpi/period";
import {
  getBadActors,
  getFailurePareto,
  getKpiSummary,
  getWorkOrderMix,
  type BadActor,
  type KpiSummary,
} from "@/lib/kpi/queries";

/**
 * Datos del reporte mensual. Reutiliza exactamente las mismas consultas que
 * alimentan el dashboard: si el PDF y la pantalla divergen, el reporte deja de
 * servir para tomar decisiones.
 */
export type MonthlyReport = {
  period: Period;
  /** Formateadores vigentes, resueltos una vez y transportados con los datos. */
  fmt: Formatters;
  /** Nombre de la instalación: el buque o la planta. Sale de los datos, no
   *  está cableado: el reporte es del cliente, no del proveedor. */
  installation: { name: string; location: string | null };
  monthLabel: string;
  generatedAt: Date;
  summary: KpiSummary;
  mix: Array<{ type: string; count: number; hours: number }>;
  pareto: Array<{
    label: string;
    category: string;
    occurrences: number;
    value: number;
    percentage: number;
    isVital: boolean;
  }>;
  badActors: BadActor[];
  patterns: Array<{
    assetTag: string;
    failureMode: string;
    occurrences: number;
    downtimeHours: number;
    trend: string;
    band: string;
  }>;
  closed: number;
  opened: number;
  formatted: {
    mttr: string;
    mtbf: string;
    availability: string;
    pmCompliance: string;
    reactive: string;
    backlog: string;
  };
};

const MONTHS = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export async function buildMonthlyReport(
  year: number,
  month: number,
): Promise<MonthlyReport> {
  const period = monthPeriod(year, month);

  const [summary, mix, pareto, badActors, patterns, counts] = await Promise.all([
    getKpiSummary(period),
    getWorkOrderMix(period),
    getFailurePareto(period),
    getBadActors(period, 8),
    getFailurePatterns(365),
    db.execute(sql`
      SELECT
        COUNT(*) FILTER (
          WHERE reported_at >= ${period.from.toISOString()}::timestamptz
            AND reported_at < ${period.to.toISOString()}::timestamptz
            AND status <> 'anulada'
        )::int AS opened,
        COUNT(*) FILTER (
          WHERE finished_at >= ${period.from.toISOString()}::timestamptz
            AND finished_at < ${period.to.toISOString()}::timestamptz
            AND status = 'cerrada'
        )::int AS closed
      FROM work_orders
    `) as unknown as Promise<Array<{ opened: number; closed: number }>>,
  ]);

  const [{ opened, closed }] = counts;

  // Raíz del árbol de activos: el buque o la planta.
  const [root] = (await db.execute(sql`
    SELECT name, location FROM assets WHERE parent_id IS NULL ORDER BY id LIMIT 1
  `)) as unknown as Array<{ name: string; location: string | null }>;

  const fmt = await getFormatters();

  return {
    period,
    fmt,
    installation: root ?? { name: "Instalación", location: null },
    monthLabel: `${MONTHS[month]} ${year}`,
    generatedAt: new Date(),
    summary,
    mix,
    pareto: pareto.slice(0, 8),
    badActors,
    // Solo los patrones que tocaron este activo en el periodo importan al mes.
    patterns: patterns.slice(0, 6).map((p) => ({
      assetTag: p.assetTag,
      failureMode: p.failureMode,
      occurrences: p.occurrences,
      downtimeHours: p.downtimeHours,
      trend: p.trend,
      band: p.band,
    })),
    opened,
    closed,
    formatted: {
      mttr: formatHours(summary.mttrHours),
      mtbf: formatHours(summary.mtbfHours),
      availability: toPercent(summary.operationalAvailability),
      pmCompliance: toPercent(summary.pmCompliance),
      reactive: toPercent(summary.correctiveRatio),
      backlog: formatHours(summary.backlogHours),
    },
  };
}

/** Meses que tienen al menos una orden reportada, del más reciente al más antiguo. */
export async function getAvailableMonths(): Promise<
  Array<{ value: string; label: string }>
> {
  const rows = (await db.execute(sql`
    SELECT DISTINCT to_char(reported_at, 'YYYY-MM') AS ym
    FROM work_orders
    WHERE status <> 'anulada'
    ORDER BY ym DESC
    LIMIT 24
  `)) as unknown as Array<{ ym: string }>;

  return rows.map((r) => {
    const [y, m] = r.ym.split("-");
    return { value: r.ym, label: `${MONTHS[Number(m) - 1]} ${y}` };
  });
}
