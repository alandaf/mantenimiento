import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { workOrderMaterials } from "@/db/schema";
import { Panel } from "@/components/ui";
import { MaterialForm } from "@/components/record-forms";
import { getActiveOrgId } from "@/lib/org";

/**
 * Materiales y repuestos consumidos en la orden.
 *
 * El costo de repuestos dice cuánto; esta lista dice en qué. Es la que permite
 * ver que el mismo sello se cambia cada tres meses.
 */
export async function MaterialsPanel({
  workOrderId,
  editable = false,
  currencySymbol,
}: {
  workOrderId: number;
  editable?: boolean;
  currencySymbol: string;
}) {
  const orgId = await getActiveOrgId();
  const filas = await db
    .select()
    .from(workOrderMaterials)
    .where(
      and(
        eq(workOrderMaterials.organizationId, orgId),
        eq(workOrderMaterials.workOrderId, workOrderId),
      ),
    )
    .orderBy(asc(workOrderMaterials.id));

  if (filas.length === 0 && !editable) return null;

  const total = filas.reduce((s, f) => s + Number(f.quantity) * Number(f.unitCost), 0);
  const fmt = (n: number) => `${currencySymbol}${Math.round(n).toLocaleString("es-CL")}`;

  return (
    <Panel title="Materiales y repuestos" hint={filas.length ? `total ${fmt(total)}` : undefined}>
      {filas.length === 0 ? (
        <p className="px-5 py-4 text-[11px] text-ink-500">Sin materiales registrados.</p>
      ) : (
        <ul className="divide-y divide-ink-800">
          {filas.map((f) => (
            <li key={f.id} className="flex items-baseline justify-between gap-3 px-5 py-2.5">
              <div className="min-w-0">
                <p className="text-xs text-ink-200">{f.description}</p>
                <p className="num text-[11px] text-ink-500">
                  {Number(f.quantity)} {f.unit ?? "u"}
                  {f.partNumber && ` · N° ${f.partNumber}`}
                </p>
              </div>
              <span className="num shrink-0 text-xs text-ink-300">
                {fmt(Number(f.quantity) * Number(f.unitCost))}
              </span>
            </li>
          ))}
        </ul>
      )}
      {editable && <MaterialForm workOrderId={workOrderId} currencySymbol={currencySymbol} />}
    </Panel>
  );
}
