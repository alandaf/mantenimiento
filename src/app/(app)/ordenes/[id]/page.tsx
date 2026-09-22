import { and, eq } from "drizzle-orm";
import { getFormatters } from "@/lib/config";
import { notFound } from "next/navigation";
import { AuditTrail } from "@/components/audit-trail";
import { MeasurementsPanel } from "@/components/measurements-panel";
import { MaterialsPanel } from "@/components/materials-panel";
import { AttachmentsPanel } from "@/components/attachments-panel";
import { TaskChecklist } from "@/components/task-checklist";
import { assets } from "@/db/schema";
import { exigeSegundaFirma } from "@/lib/kpi/approval";
import { ApprovalPanel } from "./approval-panel";
import { ClosePanel } from "./close-panel";
import { workOrderTasks } from "@/db/schema";
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

  // Estado de la pauta, para saber si la orden se puede cerrar ya.
  const pasos = await db
    .select({ result: workOrderTasks.result })
    .from(workOrderTasks)
    .where(
      and(
        eq(workOrderTasks.workOrderId, id),
        eq(workOrderTasks.organizationId, orgId),
      ),
    );
  const pendientes = pasos.filter((p) => p.result === null).length;
  const abierta = !["cerrada", "anulada"].includes(workOrder.status);

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

      {/*
        La pauta va ARRIBA del formulario, no al final.
        Quien abre una rutina preventiva viene a ejecutarla, no a editar sus
        campos administrativos: lo primero que tiene que ver es qué hacer en el
        equipo. Enterrarla bajo cuatro secciones de formulario la vuelve
        invisible, que es tanto como no tenerla.
      */}
      <div className="px-6 pt-5">
        <TaskChecklist
          workOrderId={id}
          // La pauta se ejecuta mientras la orden sigue viva. Una cerrada o
          // aprobada es el registro de lo que pasó, no un formulario.
          editable={
            !["cerrada", "anulada"].includes(workOrder.status) &&
            !workOrder.approvedBy
          }
        />
      </div>

      {/*
        La clave remonta el formulario cuando cambia el costo de repuestos: al
        agregar un material el servidor lo suma, y un campo no controlado
        seguiría mostrando el valor viejo y lo reescribiría al guardar.
      */}
      <WorkOrderForm key={String(workOrder.partsCost)} currencySymbol={currencySymbol} action={action} workOrder={workOrder} {...catalogs} />
      <div className="grid gap-5 px-6 pb-6 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          {abierta && (
            <ClosePanel
              workOrderId={id}
              pasosPendientes={pendientes}
              totalPasos={pasos.length}
            />
          )}
          <AttachmentsPanel
            entidad="orden_trabajo"
            entidadId={id}
            hint="evidencia e informes"
          />
          <MeasurementsPanel workOrderId={id} editable={abierta && !workOrder.approvedBy} />
          <MaterialsPanel
            workOrderId={id}
            editable={abierta && !workOrder.approvedBy}
            currencySymbol={currencySymbol}
          />
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
        <div className="lg:col-span-2">
          <AuditTrail entidad="orden_trabajo" entidadId={id} />
        </div>
      </div>
    </>
  );
}
