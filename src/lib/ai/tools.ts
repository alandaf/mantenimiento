import { sql } from "drizzle-orm";
import { db } from "@/db";
import { lastDays } from "@/lib/kpi/period";
import { getFailurePareto, getKpiSummary } from "@/lib/kpi/queries";
import { riskBand, riskScore } from "@/lib/kpi/risk";

/**
 * Herramientas de solo lectura que el modelo puede invocar.
 *
 * Regla del diseño: el modelo nunca calcula un indicador. Cada herramienta
 * devuelve cifras ya computadas en SQL o por funciones puras con tests, y la IA
 * solo las interpreta. Así una recomendación siempre es rastreable hasta los
 * datos que la sustentan.
 */

export type OpenWorkOrder = {
  id: number;
  code: string;
  title: string;
  assetTag: string;
  assetName: string;
  criticality: "A" | "B" | "C";
  status: string;
  priority: number;
  ageDays: number;
  repeatFailures90d: number;
  downtimeCostPerHour: number;
  failureMode: string | null;
  technician: string | null;
  estimatedHours: number;
  riskScore: number;
  riskBand: string;
};

/**
 * Órdenes abiertas con su score de riesgo ya calculado. Es la entrada principal
 * de la priorización: el modelo reordena y justifica sobre esta base, no la
 * inventa.
 */
export async function getOpenWorkOrders(limit = 40): Promise<OpenWorkOrder[]> {
  const rows = (await db.execute(sql`
    SELECT
      wo.id, wo.code, wo.title,
      wo.status::text AS status,
      wo.priority,
      wo.estimated_hours::float AS estimated_hours,
      EXTRACT(EPOCH FROM (now() - wo.reported_at)) / 86400.0 AS age_days,
      a.tag AS asset_tag,
      a.name AS asset_name,
      a.criticality::text AS criticality,
      a.downtime_cost_per_hour,
      fm.name AS failure_mode,
      t.name AS technician,
      (SELECT COUNT(*) FROM work_orders w2
        WHERE w2.asset_id = wo.asset_id
          AND w2.type = 'correctivo'
          AND w2.status <> 'anulada'
          AND w2.reported_at > now() - interval '90 days'
      )::int AS repeat_failures_90d
    FROM work_orders wo
    JOIN assets a ON a.id = wo.asset_id
    LEFT JOIN failure_modes fm ON fm.id = wo.failure_mode_id
    LEFT JOIN technicians t ON t.id = wo.assigned_to
    WHERE wo.status IN ('abierta', 'asignada', 'ejecucion', 'pausada')
    ORDER BY wo.reported_at ASC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: number;
    code: string;
    title: string;
    status: string;
    priority: number;
    estimated_hours: number;
    age_days: number;
    asset_tag: string;
    asset_name: string;
    criticality: "A" | "B" | "C";
    downtime_cost_per_hour: number;
    failure_mode: string | null;
    technician: string | null;
    repeat_failures_90d: number;
  }>;

  return rows
    .map((r) => {
      const { score } = riskScore({
        criticality: r.criticality,
        priority: r.priority,
        ageDays: r.age_days,
        repeatFailures90d: r.repeat_failures_90d,
        downtimeCostPerHour: r.downtime_cost_per_hour,
      });
      return {
        id: r.id,
        code: r.code,
        title: r.title,
        assetTag: r.asset_tag,
        assetName: r.asset_name,
        criticality: r.criticality,
        status: r.status,
        priority: r.priority,
        ageDays: Math.round(r.age_days * 10) / 10,
        repeatFailures90d: r.repeat_failures_90d,
        downtimeCostPerHour: r.downtime_cost_per_hour,
        failureMode: r.failure_mode,
        technician: r.technician,
        estimatedHours: r.estimated_hours,
        riskScore: score,
        riskBand: riskBand(score),
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore);
}

/** Historial de fallas de un activo — evidencia para el análisis de repetitividad. */
async function getAssetHistory(assetTag: string, days = 365) {
  const rows = (await db.execute(sql`
    SELECT
      wo.code, wo.title,
      wo.type::text AS type,
      wo.status::text AS status,
      to_char(wo.reported_at, 'YYYY-MM-DD') AS reported_at,
      wo.downtime_minutes,
      (wo.labor_cost + wo.parts_cost)::float AS cost,
      fm.name AS failure_mode
    FROM work_orders wo
    JOIN assets a ON a.id = wo.asset_id
    LEFT JOIN failure_modes fm ON fm.id = wo.failure_mode_id
    WHERE a.tag = ${assetTag}
      AND wo.reported_at > now() - (${days} || ' days')::interval
      AND wo.status <> 'anulada'
    ORDER BY wo.reported_at DESC
    LIMIT 50
  `)) as unknown as unknown[];
  return rows;
}

/** Ficha del activo más su posición en la jerarquía. */
async function getAssetContext(assetTag: string) {
  const [row] = (await db.execute(sql`
    SELECT
      a.tag, a.name,
      a.criticality::text AS criticality,
      a.status::text AS status,
      a.location, a.manufacturer, a.model,
      a.downtime_cost_per_hour,
      p.tag AS parent_tag,
      p.name AS parent_name,
      (SELECT COUNT(*) FROM pm_plans pp WHERE pp.asset_id = a.id AND pp.active)::int AS pm_plans,
      (SELECT COUNT(*) FROM pm_plans pp
        WHERE pp.asset_id = a.id AND pp.active AND pp.next_due_at < now())::int AS pm_overdue
    FROM assets a
    LEFT JOIN assets p ON p.id = a.parent_id
    WHERE a.tag = ${assetTag}
  `)) as unknown as unknown[];
  return row ?? { error: `No existe un activo con tag ${assetTag}` };
}

/**
 * Definiciones que ve el modelo, en el formato de function calling de Gemini.
 * Las descripciones dicen *cuándo* usar cada herramienta, no solo qué hace:
 * es lo que más influye en que el modelo la invoque en el momento correcto.
 */
export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    name: "get_kpis",
    description:
      "Indicadores de mantenimiento del periodo: MTTR, MTBF, disponibilidad, " +
      "cumplimiento del plan preventivo, proporción de trabajo reactivo, backlog y costo. " +
      "Todos calculados en SQL sobre los datos reales. Úsala para situar la priorización " +
      "en el contexto operativo de la planta antes de decidir el orden.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Ventana en días hacia atrás. Por defecto 90.",
        },
      },
      required: [],
    },
  },
  {
    type: "function" as const,
    name: "get_failure_pareto",
    description:
      "Pareto de modos de falla por horas de parada acumuladas en el periodo, con el " +
      "porcentaje de cada uno y cuáles forman el 80% del impacto. Úsala para saber si la " +
      "falla de una OT pertenece a un patrón repetitivo que ya está costando caro.",
    parameters: {
      type: "object",
      properties: {
        days: {
          type: "integer",
          description: "Ventana en días hacia atrás. Por defecto 90.",
        },
      },
      required: [],
    },
  },
  {
    type: "function" as const,
    name: "get_asset_context",
    description:
      "Ficha de un activo: criticidad, ubicación, fabricante, costo de parada por hora, " +
      "activo padre y estado de sus planes preventivos (cuántos hay y cuántos vencidos). " +
      "Úsala cuando necesites entender por qué un activo concreto importa.",
    parameters: {
      type: "object",
      properties: {
        asset_tag: {
          type: "string",
          description: "Tag del activo, por ejemplo EQ-102.",
        },
      },
      required: ["asset_tag"],
    },
  },
  {
    type: "function" as const,
    name: "get_asset_history",
    description:
      "Historial de órdenes de trabajo de un activo: fechas, modos de falla, minutos de " +
      "parada y costo. Úsala para verificar si una falla se repite y con qué frecuencia, " +
      "antes de afirmar que hay un patrón.",
    parameters: {
      type: "object",
      properties: {
        asset_tag: { type: "string", description: "Tag del activo." },
        days: {
          type: "integer",
          description: "Ventana en días hacia atrás. Por defecto 365.",
        },
      },
      required: ["asset_tag"],
    },
  },
];

/** Ejecuta una herramienta por nombre. Los errores se devuelven al modelo. */
export async function executeTool(
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "get_kpis":
      return getKpiSummary(lastDays(Number(input.days) || 90));
    case "get_failure_pareto":
      return getFailurePareto(lastDays(Number(input.days) || 90));
    case "get_asset_context":
      return getAssetContext(String(input.asset_tag));
    case "get_asset_history":
      return getAssetHistory(String(input.asset_tag), Number(input.days) || 365);
    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}
