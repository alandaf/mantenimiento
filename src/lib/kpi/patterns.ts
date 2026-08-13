import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  chronicityBand,
  meanIntervalDays,
  nextExpectedFailure,
  recurrencePriority,
  recurrenceTrend,
  type ChronicityBand,
  type RecurrenceTrend,
} from "./recurrence";

/**
 * Patrón de falla repetitiva: un mismo modo de falla que reincide en un mismo
 * activo. La agregación se hace en SQL; la estadística de intervalos y la
 * priorización salen de las funciones puras de recurrence.ts.
 */
export type FailurePattern = {
  /** Identificador estable del patrón: activo + modo de falla. */
  key: string;
  assetId: number;
  assetTag: string;
  assetName: string;
  criticality: "A" | "B" | "C";
  failureModeId: number;
  failureMode: string;
  category: string;
  occurrences: number;
  downtimeHours: number;
  cost: number;
  dates: string[];
  firstSeen: string;
  lastSeen: string;
  meanIntervalDays: number | null;
  trend: RecurrenceTrend;
  band: ChronicityBand;
  nextExpected: string | null;
  priority: number;
};

/**
 * Devuelve los patrones con dos o más ocurrencias, ordenados por prioridad.
 * Una sola falla no es un patrón: no hay intervalo que medir ni recurrencia que
 * explicar, así que se excluye en el HAVING.
 */
export async function getFailurePatterns(days = 365): Promise<FailurePattern[]> {
  const rows = (await db.execute(sql`
    SELECT
      a.id AS asset_id,
      a.tag AS asset_tag,
      a.name AS asset_name,
      a.criticality::text AS criticality,
      fm.id AS failure_mode_id,
      fm.name AS failure_mode,
      fm.category::text AS category,
      COUNT(*)::int AS occurrences,
      COALESCE(SUM(wo.downtime_minutes), 0)::float / 60.0 AS downtime_hours,
      COALESCE(SUM(wo.labor_cost + wo.parts_cost), 0)::float AS cost,
      array_agg(to_char(wo.reported_at, 'YYYY-MM-DD') ORDER BY wo.reported_at) AS dates
    FROM work_orders wo
    JOIN assets a ON a.id = wo.asset_id
    JOIN failure_modes fm ON fm.id = wo.failure_mode_id
    WHERE wo.type = 'correctivo'
      AND wo.status <> 'anulada'
      AND wo.reported_at > now() - (${days} || ' days')::interval
    GROUP BY a.id, a.tag, a.name, a.criticality, fm.id, fm.name, fm.category
    HAVING COUNT(*) >= 2
  `)) as unknown as Array<{
    asset_id: number;
    asset_tag: string;
    asset_name: string;
    criticality: "A" | "B" | "C";
    failure_mode_id: number;
    failure_mode: string;
    category: string;
    occurrences: number;
    downtime_hours: number;
    cost: number;
    dates: string[];
  }>;

  return rows
    .map((r) => {
      const parsed = r.dates.map((d) => new Date(`${d}T00:00:00Z`));
      const trend = recurrenceTrend(parsed);
      const next = nextExpectedFailure(parsed);

      return {
        key: `${r.asset_id}-${r.failure_mode_id}`,
        assetId: r.asset_id,
        assetTag: r.asset_tag,
        assetName: r.asset_name,
        criticality: r.criticality,
        failureModeId: r.failure_mode_id,
        failureMode: r.failure_mode,
        category: r.category,
        occurrences: r.occurrences,
        downtimeHours: Math.round(r.downtime_hours * 10) / 10,
        cost: r.cost,
        dates: r.dates,
        firstSeen: r.dates[0],
        lastSeen: r.dates.at(-1)!,
        meanIntervalDays: meanIntervalDays(parsed),
        trend,
        band: chronicityBand(r.occurrences, r.downtime_hours),
        nextExpected: next ? next.toISOString().slice(0, 10) : null,
        priority: recurrencePriority({
          occurrences: r.occurrences,
          downtimeHours: r.downtime_hours,
          trend,
          criticality: r.criticality,
        }),
      };
    })
    .sort((a, b) => b.priority - a.priority);
}

/** Un patrón concreto por su clave `assetId-failureModeId`. */
export async function getFailurePattern(
  key: string,
): Promise<FailurePattern | null> {
  const patterns = await getFailurePatterns();
  return patterns.find((p) => p.key === key) ?? null;
}
