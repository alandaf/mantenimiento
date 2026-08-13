import { and, eq } from "drizzle-orm";
import { getFormatters } from "@/lib/config";
import { notFound } from "next/navigation";
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

  const action = updateWorkOrder.bind(null, id);

  return (
    <>
      <PageHeader title={workOrder.code} subtitle={workOrder.title} />
      <WorkOrderForm currencySymbol={currencySymbol} action={action} workOrder={workOrder} {...catalogs} />
    </>
  );
}
