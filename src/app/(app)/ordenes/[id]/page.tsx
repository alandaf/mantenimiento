import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
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
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const [[workOrder], catalogs] = await Promise.all([
    db.select().from(workOrders).where(eq(workOrders.id, id)),
    getWorkOrderCatalogs(),
  ]);
  if (!workOrder) notFound();

  const action = updateWorkOrder.bind(null, id);

  return (
    <>
      <PageHeader title={workOrder.code} subtitle={workOrder.title} />
      <WorkOrderForm action={action} workOrder={workOrder} {...catalogs} />
    </>
  );
}
