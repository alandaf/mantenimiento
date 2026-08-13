import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
import {
  correctiveRatio,
  inherentAvailability,
  mtbf,
  mttr,
  operationalAvailability,
  pareto,
  pmCompliance,
} from "./formulas";
import { calendarHours, type Period } from "./period";

/**
 * Toda la agregación pasa por SQL. La capa de IA (F3) consumirá exactamente
 * estos mismos resultados vía tool use: nunca calcula un número por su cuenta.
 */

type RawTotals = {
  corrective_closed: number;
  repair_hours: number;
  failure_count: number;
  downtime_hours: number;
  total_labor_hours: number;
  corrective_labor_hours: number;
  total_cost: number;
  active_assets: number;
};

export type KpiSummary = {
  period: Period;
  mttrHours: number | null;
  mtbfHours: number | null;
  inherentAvailability: number | null;
  operationalAvailability: number | null;
  pmCompliance: number | null;
  correctiveRatio: number | null;
  backlogHours: number;
  openWorkOrders: number;
  totalCost: number;
  failureCount: number;
};

export async function getKpiSummary(period: Period): Promise<KpiSummary> {
  const orgId = await getActiveOrgId();
  const [totals] = (await db.execute(sql`
    SELECT
      COUNT(*) FILTER (
        WHERE type = 'correctivo' AND status = 'cerrada' AND started_at IS NOT NULL AND finished_at IS NOT NULL
      )::int AS corrective_closed,
      COALESCE(SUM(
        EXTRACT(EPOCH FROM (finished_at - started_at)) / 3600.0
      ) FILTER (
        WHERE type = 'correctivo' AND status = 'cerrada' AND started_at IS NOT NULL AND finished_at IS NOT NULL
      ), 0)::float AS repair_hours,
      COUNT(*) FILTER (WHERE type = 'correctivo' AND status <> 'anulada')::int AS failure_count,
      COALESCE(SUM(downtime_minutes) FILTER (WHERE status <> 'anulada'), 0)::float / 60.0 AS downtime_hours,
      COALESCE(SUM(labor_hours) FILTER (WHERE status = 'cerrada'), 0)::float AS total_labor_hours,
      COALESCE(SUM(labor_hours) FILTER (WHERE status = 'cerrada' AND type = 'correctivo'), 0)::float AS corrective_labor_hours,
      COALESCE(SUM(labor_cost + parts_cost) FILTER (WHERE status <> 'anulada'), 0)::float AS total_cost,
      -- Solo hojas del árbol: la planta y las líneas son agrupadores, no
      -- equipos, y contarlas inflaría el tiempo operativo de la flota.
      (SELECT COUNT(*) FROM assets a
        WHERE a.organization_id = ${orgId} AND a.status <> 'baja'
          AND NOT EXISTS (SELECT 1 FROM assets c WHERE c.parent_id = a.id)
      )::int AS active_assets
    FROM work_orders
    WHERE organization_id = ${orgId} AND reported_at >= ${period.from.toISOString()}::timestamptz AND reported_at < ${period.to.toISOString()}::timestamptz
  `)) as unknown as RawTotals[];

  const [backlog] = (await db.execute(sql`
    SELECT
      COALESCE(SUM(estimated_hours), 0)::float AS backlog_hours,
      COUNT(*)::int AS open_count
    FROM work_orders
    WHERE organization_id = ${orgId} AND status IN ('abierta', 'asignada', 'ejecucion', 'pausada')
  `)) as unknown as Array<{ backlog_hours: number; open_count: number }>;

  const [pm] = (await db.execute(sql`
    SELECT
      COUNT(*)::int AS scheduled,
      COUNT(*) FILTER (WHERE status = 'cerrada')::int AS executed
    FROM work_orders
    WHERE organization_id = ${orgId} AND type = 'preventivo'
      AND status <> 'anulada'
      AND reported_at >= ${period.from.toISOString()}::timestamptz AND reported_at < ${period.to.toISOString()}::timestamptz
  `)) as unknown as Array<{ scheduled: number; executed: number }>;

  // El tiempo operativo de la flota es calendario × activos, menos la parada
  // real. Usar calendario a secas inflaría el MTBF de forma grosera.
  const hours = calendarHours(period);
  const fleetCalendarHours = hours * Math.max(1, totals.active_assets);
  const operatingHours = Math.max(0, fleetCalendarHours - totals.downtime_hours);

  const mttrValue = mttr(totals.repair_hours, totals.corrective_closed);
  const mtbfValue = mtbf(operatingHours, totals.failure_count);

  return {
    period,
    mttrHours: mttrValue,
    mtbfHours: mtbfValue,
    inherentAvailability: inherentAvailability(mtbfValue, mttrValue),
    operationalAvailability: operationalAvailability(
      fleetCalendarHours,
      totals.downtime_hours,
    ),
    pmCompliance: pmCompliance(pm.executed, pm.scheduled),
    correctiveRatio: correctiveRatio(
      totals.corrective_labor_hours,
      totals.total_labor_hours,
    ),
    backlogHours: backlog.backlog_hours,
    openWorkOrders: backlog.open_count,
    totalCost: totals.total_cost,
    failureCount: totals.failure_count,
  };
}

export type TrendPoint = {
  month: string;
  availability: number | null;
  mttrHours: number | null;
  failures: number;
};

/** Serie mensual de disponibilidad — el gráfico principal del dashboard. */
export async function getAvailabilityTrend(months = 12): Promise<TrendPoint[]> {
  const orgId = await getActiveOrgId();
  const rows = (await db.execute(sql`
    WITH meses AS (
      SELECT generate_series(
        date_trunc('month', now()) - (${months - 1} || ' months')::interval,
        date_trunc('month', now()),
        '1 month'
      ) AS mes
    ),
    activos AS (
      -- Mismo criterio que getKpiSummary: solo equipos, no agrupadores.
      SELECT COUNT(*)::float AS n FROM assets a
      WHERE a.organization_id = ${orgId} AND a.status <> 'baja'
        AND NOT EXISTS (SELECT 1 FROM assets c WHERE c.parent_id = a.id)
    ),
    datos AS (
      SELECT
        date_trunc('month', wo.reported_at) AS mes,
        COALESCE(SUM(wo.downtime_minutes), 0)::float / 60.0 AS downtime_hours,
        COUNT(*) FILTER (WHERE wo.type = 'correctivo')::int AS failures,
        COALESCE(AVG(
          EXTRACT(EPOCH FROM (wo.finished_at - wo.started_at)) / 3600.0
        ) FILTER (
          WHERE wo.type = 'correctivo' AND wo.finished_at IS NOT NULL AND wo.started_at IS NOT NULL
        ), NULL)::float AS mttr_hours
      FROM work_orders wo
      WHERE wo.organization_id = ${orgId} AND wo.status <> 'anulada'
      GROUP BY 1
    )
    SELECT
      to_char(m.mes, 'YYYY-MM') AS month,
      COALESCE(d.failures, 0) AS failures,
      d.mttr_hours,
      -- horas calendario del mes × nº de activos = capacidad operativa
      GREATEST(0, LEAST(1,
        1 - COALESCE(d.downtime_hours, 0) /
            NULLIF(EXTRACT(DAY FROM (date_trunc('month', m.mes) + interval '1 month' - interval '1 day')) * 24 * a.n, 0)
      ))::float AS availability
    FROM meses m
    CROSS JOIN activos a
    LEFT JOIN datos d ON d.mes = m.mes
    ORDER BY m.mes
  `)) as unknown as Array<{
    month: string;
    failures: number;
    mttr_hours: number | null;
    availability: number | null;
  }>;

  return rows.map((r) => ({
    month: r.month,
    availability: r.availability,
    mttrHours: r.mttr_hours,
    failures: r.failures,
  }));
}

/** Pareto de modos de falla: dónde está el 80% del dolor. */
export async function getFailurePareto(period: Period) {
  const orgId = await getActiveOrgId();
  const rows = (await db.execute(sql`
    SELECT
      fm.name AS label,
      fm.category::text AS category,
      COUNT(*)::int AS occurrences,
      COALESCE(SUM(wo.downtime_minutes), 0)::float / 60.0 AS downtime_hours
    FROM work_orders wo
    JOIN failure_modes fm ON fm.id = wo.failure_mode_id
    WHERE wo.organization_id = ${orgId}
      AND wo.type = 'correctivo'
      AND wo.status <> 'anulada'
      AND wo.reported_at >= ${period.from.toISOString()}::timestamptz AND wo.reported_at < ${period.to.toISOString()}::timestamptz
    GROUP BY fm.id, fm.name, fm.category
  `)) as unknown as Array<{
    label: string;
    category: string;
    occurrences: number;
    downtime_hours: number;
  }>;

  // Se ordena por horas de parada, no por número de eventos: veinte fallas
  // triviales importan menos que dos que detuvieron la línea un turno entero.
  return pareto(
    rows.map((r) => ({
      label: r.label,
      category: r.category,
      occurrences: r.occurrences,
      value: r.downtime_hours,
    })),
  );
}

export type BadActor = {
  assetId: number;
  tag: string;
  name: string;
  criticality: string;
  failures: number;
  downtimeHours: number;
  cost: number;
  mttrHours: number | null;
  mtbfHours: number | null;
};

/** Ranking de "malos actores": los activos que consumen el presupuesto. */
export async function getBadActors(period: Period, limit = 10): Promise<BadActor[]> {
  const orgId = await getActiveOrgId();
  const hours = calendarHours(period);

  const rows = (await db.execute(sql`
    SELECT
      a.id AS asset_id,
      a.tag,
      a.name,
      a.criticality::text AS criticality,
      COUNT(*) FILTER (WHERE wo.type = 'correctivo')::int AS failures,
      COALESCE(SUM(wo.downtime_minutes), 0)::float / 60.0 AS downtime_hours,
      COALESCE(SUM(wo.labor_cost + wo.parts_cost), 0)::float AS cost,
      AVG(
        EXTRACT(EPOCH FROM (wo.finished_at - wo.started_at)) / 3600.0
      ) FILTER (
        WHERE wo.type = 'correctivo' AND wo.finished_at IS NOT NULL AND wo.started_at IS NOT NULL
      )::float AS mttr_hours
    FROM work_orders wo
    JOIN assets a ON a.id = wo.asset_id
    WHERE wo.organization_id = ${orgId}
      AND wo.status <> 'anulada'
      AND wo.reported_at >= ${period.from.toISOString()}::timestamptz AND wo.reported_at < ${period.to.toISOString()}::timestamptz
    GROUP BY a.id, a.tag, a.name, a.criticality
    HAVING COUNT(*) FILTER (WHERE wo.type = 'correctivo') > 0
    ORDER BY downtime_hours DESC, cost DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    asset_id: number;
    tag: string;
    name: string;
    criticality: string;
    failures: number;
    downtime_hours: number;
    cost: number;
    mttr_hours: number | null;
  }>;

  return rows.map((r) => ({
    assetId: r.asset_id,
    tag: r.tag,
    name: r.name,
    criticality: r.criticality,
    failures: r.failures,
    downtimeHours: r.downtime_hours,
    cost: r.cost,
    mttrHours: r.mttr_hours,
    mtbfHours: mtbf(Math.max(0, hours - r.downtime_hours), r.failures),
  }));
}

/** Distribución de OT por tipo — muestra si el mantenimiento es reactivo. */
export async function getWorkOrderMix(period: Period) {
  const orgId = await getActiveOrgId();
  const rows = (await db.execute(sql`
    SELECT
      type::text AS type,
      COUNT(*)::int AS count,
      COALESCE(SUM(labor_hours), 0)::float AS hours
    FROM work_orders
    WHERE organization_id = ${orgId}
      AND status <> 'anulada'
      AND reported_at >= ${period.from.toISOString()}::timestamptz AND reported_at < ${period.to.toISOString()}::timestamptz
    GROUP BY type
    ORDER BY count DESC
  `)) as unknown as Array<{ type: string; count: number; hours: number }>;

  return rows;
}
