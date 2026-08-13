import { PageHeader } from "@/components/ui";
import { getFormatters } from "@/lib/config";
import { createWorkOrder } from "@/lib/actions/work-orders";
import { getWorkOrderCatalogs } from "@/lib/catalogs";
import { WorkOrderForm } from "../work-order-form";

export const dynamic = "force-dynamic";

export default async function NewWorkOrderPage() {
  const { currencySymbol } = await getFormatters();
  const catalogs = await getWorkOrderCatalogs();

  return (
    <>
      <PageHeader
        title="Nueva orden de trabajo"
        subtitle="El código correlativo se asigna automáticamente al guardar"
      />
      <WorkOrderForm currencySymbol={currencySymbol} action={createWorkOrder} {...catalogs} />
    </>
  );
}
