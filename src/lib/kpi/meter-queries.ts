import { sql } from "drizzle-orm";
import { db } from "@/db";
import {
  latestReading,
  pmStatus,
  runRatePerDay,
  type PmStatus,
  type PmTrigger,
} from "./meters";

/** Estado de horómetro de un activo, con su ritmo de uso. */
export type AssetMeter = {
  assetId: number;
  tag: string;
  name: string;
  criticality: "A" | "B" | "C";
  location: string | null;
  currentHours: number | null;
  lastReadingAt: Date | null;
  /** Días desde la última lectura: una lectura vieja invalida el ritmo. */
  staleDays: number | null;
  ratePerDay: number | null;
  readings: number;
};

export async function getAssetMeters(): Promise<AssetMeter[]> {
  const rows = (await db.execute(sql`
    SELECT
      a.id AS asset_id, a.tag, a.name,
      a.criticality::text AS criticality,
      a.location,
      COALESCE(
        json_agg(
          json_build_object('hours', mr.hours::float, 'takenAt', mr.taken_at)
          ORDER BY mr.taken_at
        ) FILTER (WHERE mr.id IS NOT NULL),
        '[]'
      ) AS readings
    FROM assets a
    LEFT JOIN meter_readings mr ON mr.asset_id = a.id
    WHERE a.tracks_hours = true AND a.status <> 'baja'
    GROUP BY a.id, a.tag, a.name, a.criticality, a.location
    ORDER BY a.tag
  `)) as unknown as Array<{
    asset_id: number;
    tag: string;
    name: string;
    criticality: "A" | "B" | "C";
    location: string | null;
    readings: Array<{ hours: number; takenAt: string }>;
  }>;

  const now = Date.now();

  return rows.map((r) => {
    const readings = r.readings.map((x) => ({
      hours: x.hours,
      takenAt: new Date(x.takenAt),
    }));
    const last = latestReading(readings);

    return {
      assetId: r.asset_id,
      tag: r.tag,
      name: r.name,
      criticality: r.criticality,
      location: r.location,
      currentHours: last?.hours ?? null,
      lastReadingAt: last?.takenAt ?? null,
      staleDays: last
        ? Math.floor((now - last.takenAt.getTime()) / 86_400_000)
        : null,
      ratePerDay: runRatePerDay(readings),
      readings: readings.length,
    };
  });
}

export type PmPlanStatus = {
  planId: number;
  name: string;
  assetId: number;
  assetTag: string;
  assetName: string;
  criticality: "A" | "B" | "C";
  trigger: PmTrigger;
  frequencyDays: number | null;
  frequencyHours: number | null;
  estimatedHours: number;
  currentHours: number | null;
  ratePerDay: number | null;
  status: PmStatus;
};

/**
 * Planes preventivos con su estado resuelto. La proyección de fecha para las
 * rutinas por horas es lo que convierte "vence a las 12.500 h" en algo que un
 * planificador puede usar para pedir repuestos.
 */
export async function getPmPlanStatuses(): Promise<PmPlanStatus[]> {
  const meters = await getAssetMeters();
  const byAsset = new Map(meters.map((m) => [m.assetId, m]));

  const rows = (await db.execute(sql`
    SELECT
      p.id AS plan_id, p.name,
      p.trigger::text AS trigger,
      p.frequency_days, p.frequency_hours,
      p.estimated_hours::float AS estimated_hours,
      p.next_due_at, p.next_due_hours::float AS next_due_hours,
      a.id AS asset_id, a.tag AS asset_tag, a.name AS asset_name,
      a.criticality::text AS criticality
    FROM pm_plans p
    JOIN assets a ON a.id = p.asset_id
    WHERE p.active = true AND a.status <> 'baja'
  `)) as unknown as Array<{
    plan_id: number;
    name: string;
    trigger: PmTrigger;
    frequency_days: number | null;
    frequency_hours: number | null;
    estimated_hours: number;
    next_due_at: string | null;
    next_due_hours: number | null;
    asset_id: number;
    asset_tag: string;
    asset_name: string;
    criticality: "A" | "B" | "C";
  }>;

  const now = new Date();

  return rows
    .map((r) => {
      const meter = byAsset.get(r.asset_id);
      const status = pmStatus(
        {
          trigger: r.trigger,
          nextDueAt: r.next_due_at ? new Date(r.next_due_at) : null,
          nextDueHours: r.next_due_hours,
        },
        meter?.currentHours ?? null,
        meter?.ratePerDay ?? null,
        now,
      );

      return {
        planId: r.plan_id,
        name: r.name,
        assetId: r.asset_id,
        assetTag: r.asset_tag,
        assetName: r.asset_name,
        criticality: r.criticality,
        trigger: r.trigger,
        frequencyDays: r.frequency_days,
        frequencyHours: r.frequency_hours,
        estimatedHours: r.estimated_hours,
        currentHours: meter?.currentHours ?? null,
        ratePerDay: meter?.ratePerDay ?? null,
        status,
      };
    })
    // Primero lo vencido; luego lo que vence antes. Los planes sin fecha
    // proyectable (equipo detenido) van al final: no exigen acción hoy.
    .sort((a, b) => {
      if (a.status.overdue !== b.status.overdue) return a.status.overdue ? -1 : 1;
      const ad = a.status.remainingDays;
      const bd = b.status.remainingDays;
      if (ad === null && bd === null) return 0;
      if (ad === null) return 1;
      if (bd === null) return -1;
      return ad - bd;
    });
}

/** Historial de lecturas de un activo, de la más reciente a la más antigua. */
export async function getReadingHistory(assetId: number, limit = 30) {
  return (await db.execute(sql`
    SELECT
      mr.id,
      mr.hours::float AS hours,
      mr.taken_at,
      mr.source::text AS source,
      mr.note
    FROM meter_readings mr
    WHERE mr.asset_id = ${assetId}
    ORDER BY mr.taken_at DESC
    LIMIT ${limit}
  `)) as unknown as Array<{
    id: number;
    hours: number;
    taken_at: string;
    source: string;
    note: string | null;
  }>;
}
