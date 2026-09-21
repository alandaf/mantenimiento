import { and, eq } from "drizzle-orm";
import { getFormatters } from "@/lib/config";
import { notFound } from "next/navigation";
import { AuditTrail } from "@/components/audit-trail";
import { MeasurementsPanel } from "@/components/measurements-panel";
import { TaskChecklist } from "@/components/task-checklist";
import { assets } from "@/db/schema";
import { exigeSegundaFirma } from "@/lib/kpi/approval";
import { ApprovalPanel } from "./approval-panel";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
import { workOrders } from "@/db/schema";
import { updateWorkOrder } from "@/lib/actions/work-orders";
import { getWorkOrderCatalogs } from "@/lib/catalogs";
import { WorkOrderForm } from "../work-order-form";

export const dynamic = "force-dynamic";

export default async function EditWorkOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { currencySymbol } = await getFormatters();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();
  const orgId = await getActiveOrgId();

  const [[workOrder], catalogs] = await Promise.all([
    // El filtro por organización es lo que convierte un id ajeno en 404: sin
    // él, adivinar un número daba acceso a la orden de otro buque.
    db
      .select()
      .from(workOrders)
      .where(and(eq(workOrders.id, id), eq(workOrders.organizationId, orgId))),
    getWorkOrderCatalogs(),
  ]);
  if (!workOrder) notFound();

  // El activo decide si el trabajo exige la firma de un tercero.
  const [activo] = await db
    .select({
      tag: assets.tag,
      criticality: assets.criticality,
      isSafetySystem: assets.isSafetySystem,
    })
    .from(assets)
    .where(and(eq(assets.id, workOrder.assetId), eq(assets.organizationId, orgId)))
    .limit(1);

  const action = updateWorkOrder.bind(null, id);

  return (
    <>
      <PageHeader title={workOrder.code} subtitle={workOrder.title} />
      <WorkOrderForm currencySymbol={currencySymbol} action={action} workOrder={workOrder} {...catalogs} />
      <div className="grid gap-5 px-6 pb-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          <MeasurementsPanel workOrderId={id} />
          <ApprovalPanel
            workOrderId={id}
            estado={workOrder.status}
            aprobadoPor={workOrder.approvedBy}
            aprobadoEl={workOrder.approvedAt}
            exigeSegundaFirma={
              activo
                ? exigeSegundaFirma(activo.criticality, activo.isSafetySystem)
                : false
            }
            assetTag={activo?.tag ?? "el equipo"}
          />
        </div>
        <div className="space-y-5 lg:col-span-2">
          <TaskChecklist workOrderId={id} />
          <AuditTrail entidad="orden_trabajo" entidadId={id} />
        </div>
      </div>
    </>
  );
}
