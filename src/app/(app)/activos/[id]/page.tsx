import { and, asc, eq, ne } from "drizzle-orm";
import { getFormatters } from "@/lib/config";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
import { assets } from "@/db/schema";
import { updateAsset } from "@/lib/actions/assets";
import { AssetForm } from "../asset-form";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { currencySymbol } = await getFormatters();
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const orgId = await getActiveOrgId();
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, id), eq(assets.organizationId, orgId)));
  if (!asset) notFound();

  // Se excluye el propio activo de la lista de padres posibles.
  const parents = await db
    .select({ id: assets.id, tag: assets.tag, name: assets.name })
    .from(assets)
    .where(and(ne(assets.id, id), eq(assets.organizationId, orgId)))
    .orderBy(asc(assets.tag));

  const action = updateAsset.bind(null, id);

  return (
    <>
      <PageHeader title={asset.name} subtitle={`${asset.tag} · editar ficha`} />
      <AssetForm currencySymbol={currencySymbol} action={action} asset={asset} parents={parents} />
    </>
  );
}
