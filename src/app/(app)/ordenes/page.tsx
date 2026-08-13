import { sql } from "drizzle-orm";
import { getFormatters } from "@/lib/config";
import Link from "next/link";
import {
  Badge,
  Button,
  EmptyState,
  PageHeader,
  Panel,
  PriorityTag,
} from "@/components/ui";
import { db } from "@/db";
import { formatHours } from "@/lib/kpi/formulas";
import { CloseButton } from "./close-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

const STATUS_FILTERS = [
  { value: "", label: "Todas" },
  { value: "pendientes", label: "Pendientes" },
  { value: "abierta", label: "Abiertas" },
  { value: "ejecucion", label: "En ejecución" },
  { value: "cerrada", label: "Cerradas" },
];

const TYPE_FILTERS = [
  { value: "", label: "Todo tipo" },
  { value: "correctivo", label: "Correctivo" },
  { value: "preventivo", label: "Preventivo" },
  { value: "predictivo", label: "Predictivo" },
];

type Row = {
  id: number;
  code: string;
  title: string;
  type: string;
  status: string;
  priority: number;
  reported_at: Date;
  finished_at: Date | null;
  downtime_minutes: number;
  repair_hours: number | null;
  asset_tag: string;
  asset_name: string;
  technician: string | null;
  failure_mode: string | null;
};

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; tipo?: string; activo?: string; p?: string }>;
}) {
  const { dateFmt } = await getFormatters();
  const params = await searchParams;
  const page = Math.max(1, Number(params.p) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const estado = params.estado ?? "";
  const tipo = params.tipo ?? "";
  const activoId = Number(params.activo) || null;

  const statusFilter =
    estado === "pendientes"
      ? sql`AND wo.status IN ('abierta','asignada','ejecucion','pausada')`
      : estado
        ? sql`AND wo.status = ${estado}::wo_status`
        : sql``;
  const typeFilter = tipo ? sql`AND wo.type = ${tipo}::wo_type` : sql``;
  const assetFilter = activoId ? sql`AND wo.asset_id = ${activoId}` : sql``;

  const rows = (await db.execute(sql`
    SELECT
      wo.id, wo.code, wo.title,
      wo.type::text AS type,
      wo.status::text AS status,
      wo.priority, wo.reported_at, wo.finished_at, wo.downtime_minutes,
      CASE
        WHEN wo.started_at IS NOT NULL AND wo.finished_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (wo.finished_at - wo.started_at)) / 3600.0
      END::float AS repair_hours,
      a.tag AS asset_tag, a.name AS asset_name,
      t.name AS technician,
      fm.name AS failure_mode
    FROM work_orders wo
    JOIN assets a ON a.id = wo.asset_id
    LEFT JOIN technicians t ON t.id = wo.assigned_to
    LEFT JOIN failure_modes fm ON fm.id = wo.failure_mode_id
    WHERE 1 = 1 ${statusFilter} ${typeFilter} ${assetFilter}
    ORDER BY
      -- Las pendientes primero, y dentro de ellas las más urgentes.
      (wo.status IN ('cerrada','anulada')) ASC,
      wo.priority ASC,
      wo.reported_at DESC
    LIMIT ${PAGE_SIZE} OFFSET ${offset}
  `)) as unknown as Row[];

  const [{ total }] = (await db.execute(sql`
    SELECT COUNT(*)::int AS total
    FROM work_orders wo
    WHERE 1 = 1 ${statusFilter} ${typeFilter} ${assetFilter}
  `)) as unknown as Array<{ total: number }>;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (patch: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams();
    const merged = { estado, tipo, activo: params.activo, p: page, ...patch };
    for (const [k, v] of Object.entries(merged)) {
      if (v !== undefined && v !== "" && !(k === "p" && v === 1)) {
        next.set(k, String(v));
      }
    }
    const s = next.toString();
    return s ? `/ordenes?${s}` : "/ordenes";
  };

  return (
    <>
      <PageHeader
        title="Órdenes de trabajo"
        subtitle={`${total} órdenes${activoId ? " · filtrado por activo" : ""}`}
        actions={<Button href="/ordenes/nueva">+ Nueva OT</Button>}
      />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-ink-700 p-0.5">
            {STATUS_FILTERS.map((f) => (
              <Link
                key={f.value}
                href={qs({ estado: f.value, p: 1 })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  f.value === estado
                    ? "bg-brand-500 text-white"
                    : "text-ink-400 hover:text-ink-100"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          <div className="flex rounded-lg border border-ink-700 p-0.5">
            {TYPE_FILTERS.map((f) => (
              <Link
                key={f.value}
                href={qs({ tipo: f.value, p: 1 })}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                  f.value === tipo
                    ? "bg-brand-500 text-white"
                    : "text-ink-400 hover:text-ink-100"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
          {activoId && (
            <Link
              href={qs({ activo: undefined, p: 1 })}
              className="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-400 transition hover:text-ink-100"
            >
              ✕ Quitar filtro de activo
            </Link>
          )}
        </div>

        <Panel>
          {rows.length === 0 ? (
            <EmptyState message="No hay órdenes que coincidan con el filtro." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-semibold">OT</th>
                    <th className="px-5 py-2.5 font-semibold">Trabajo</th>
                    <th className="px-5 py-2.5 font-semibold">Tipo</th>
                    <th className="px-5 py-2.5 font-semibold">Estado</th>
                    <th className="px-5 py-2.5 font-semibold">Prioridad</th>
                    <th className="px-5 py-2.5 font-semibold">Responsable</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Reportado</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Reparación</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {rows.map((w) => (
                    <tr key={w.id} className="transition hover:bg-ink-850">
                      <td className="num px-5 py-3 text-xs text-ink-400">{w.code}</td>
                      <td className="px-5 py-3">
                        <Link href={`/ordenes/${w.id}`} className="hover:text-brand-300">
                          <span className="block max-w-xs truncate font-medium">
                            {w.title}
                          </span>
                        </Link>
                        <span className="text-[11px] text-ink-400">
                          {w.asset_tag} · {w.asset_name}
                          {w.failure_mode && ` — ${w.failure_mode}`}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={w.type} />
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={w.status} />
                      </td>
                      <td className="px-5 py-3">
                        <PriorityTag priority={w.priority} />
                      </td>
                      <td className="px-5 py-3 text-ink-400">{w.technician ?? "—"}</td>
                      <td className="num px-5 py-3 text-right text-ink-400">
                        {dateFmt.format(new Date(w.reported_at))}
                      </td>
                      <td className="num px-5 py-3 text-right text-ink-300">
                        {formatHours(w.repair_hours)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {!["cerrada", "anulada"].includes(w.status) && (
                          <CloseButton id={w.id} />
                        )}
                        <Link
                          href={`/ordenes/${w.id}`}
                          className="ml-3 text-xs text-ink-400 transition hover:text-brand-300"
                        >
                          Editar
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {pages > 1 && (
          <div className="flex items-center justify-between text-xs text-ink-400">
            <span>
              Página {page} de {pages}
            </span>
            <div className="flex gap-2">
              {page > 1 && (
                <Link
                  href={qs({ p: page - 1 })}
                  className="rounded-lg border border-ink-700 px-3 py-1.5 transition hover:text-ink-100"
                >
                  ← Anterior
                </Link>
              )}
              {page < pages && (
                <Link
                  href={qs({ p: page + 1 })}
                  className="rounded-lg border border-ink-700 px-3 py-1.5 transition hover:text-ink-100"
                >
                  Siguiente →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
