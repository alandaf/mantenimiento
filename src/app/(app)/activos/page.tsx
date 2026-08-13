import { asc, sql } from "drizzle-orm";
import { getFormatters } from "@/lib/config";
import Link from "next/link";
import { Badge, Button, EmptyState, PageHeader, Panel} from "@/components/ui";
import { db } from "@/db";

export const dynamic = "force-dynamic";

type Row = {
  id: number;
  tag: string;
  name: string;
  criticality: string;
  status: string;
  location: string | null;
  manufacturer: string | null;
  depth: number;
  downtime_cost_per_hour: number;
  open_wo: number;
  failures_90d: number;
};

export default async function AssetsPage() {
  const { money } = await getFormatters();
  // CTE recursiva: la jerarquía se recorre en la BD y llega ya ordenada por
  // rama, con la profundidad lista para indentar el listado.
  const rows = (await db.execute(sql`
    WITH RECURSIVE arbol AS (
      SELECT a.id, a.parent_id, 0 AS depth, a.tag::text AS path
      FROM assets a WHERE a.parent_id IS NULL
      UNION ALL
      SELECT a.id, a.parent_id, t.depth + 1, t.path || ' / ' || a.tag
      FROM assets a JOIN arbol t ON a.parent_id = t.id
    )
    SELECT
      a.id, a.tag, a.name,
      a.criticality::text AS criticality,
      a.status::text AS status,
      a.location, a.manufacturer,
      a.downtime_cost_per_hour,
      t.depth,
      (SELECT COUNT(*) FROM work_orders w
        WHERE w.asset_id = a.id
          AND w.status IN ('abierta','asignada','ejecucion','pausada'))::int AS open_wo,
      (SELECT COUNT(*) FROM work_orders w
        WHERE w.asset_id = a.id AND w.type = 'correctivo'
          AND w.reported_at > now() - interval '90 days')::int AS failures_90d
    FROM assets a
    JOIN arbol t ON t.id = a.id
    ORDER BY t.path
  `)) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Activos"
        subtitle={`${rows.length} registros · jerarquía planta → línea → equipo`}
        actions={<Button href="/activos/nuevo">+ Nuevo activo</Button>}
      />

      <div className="p-6">
        <Panel>
          {rows.length === 0 ? (
            <EmptyState message="Aún no hay activos registrados." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-semibold">Activo</th>
                    <th className="px-5 py-2.5 font-semibold">Criticidad</th>
                    <th className="px-5 py-2.5 font-semibold">Estado</th>
                    <th className="px-5 py-2.5 font-semibold">Fabricante</th>
                    <th className="px-5 py-2.5 text-right font-semibold">
                      Costo parada/h
                    </th>
                    <th className="px-5 py-2.5 text-right font-semibold">OT abiertas</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Fallas 90d</th>
                    <th className="px-5 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {rows.map((a) => (
                    <tr key={a.id} className="transition hover:bg-ink-850">
                      <td className="px-5 py-3">
                        <div style={{ paddingLeft: `${a.depth * 18}px` }}>
                          <span className="num text-xs text-ink-400">{a.tag}</span>
                          <span className="ml-2 font-medium">{a.name}</span>
                          {a.location && (
                            <span className="ml-2 text-xs text-ink-600">
                              {a.location}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={a.criticality} />
                      </td>
                      <td className="px-5 py-3">
                        <Badge value={a.status} />
                      </td>
                      <td className="px-5 py-3 text-ink-400">
                        {a.manufacturer ?? "—"}
                      </td>
                      <td className="num px-5 py-3 text-right text-ink-300">
                        {a.downtime_cost_per_hour > 0
                          ? money.format(a.downtime_cost_per_hour)
                          : "—"}
                      </td>
                      <td className="num px-5 py-3 text-right">
                        {a.open_wo > 0 ? (
                          <span className="font-medium text-warn-500">{a.open_wo}</span>
                        ) : (
                          <span className="text-ink-600">0</span>
                        )}
                      </td>
                      <td className="num px-5 py-3 text-right">
                        {a.failures_90d > 0 ? (
                          <span className="font-medium text-bad-500">
                            {a.failures_90d}
                          </span>
                        ) : (
                          <span className="text-ink-600">0</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/activos/${a.id}`}
                          className="text-xs text-ink-400 transition hover:text-brand-300"
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
      </div>
    </>
  );
}
