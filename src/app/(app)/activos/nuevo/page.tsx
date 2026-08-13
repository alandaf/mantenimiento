import { asc, eq } from "drizzle-orm";
import { getFormatters } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
import { assets } from "@/db/schema";
import { createAsset } from "@/lib/actions/assets";
import { AssetForm } from "../asset-form";

export const dynamic = "force-dynamic";

export default async function NewAssetPage() {
  const { currencySymbol } = await getFormatters();
  const parents = await db
    .select({ id: assets.id, tag: assets.tag, name: assets.name })
    .from(assets)
    .where(eq(assets.organizationId, await getActiveOrgId()))
    .orderBy(asc(assets.tag));

  return (
    <>
      <PageHeader title="Nuevo activo" subtitle="Alta en el registro de equipos" />
      <AssetForm currencySymbol={currencySymbol} action={createAsset} parents={parents} />
    </>
  );
}
