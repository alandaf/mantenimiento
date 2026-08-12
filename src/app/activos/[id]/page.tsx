import { asc, eq, ne } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { db } from "@/db";
import { assets } from "@/db/schema";
import { updateAsset } from "@/lib/actions/assets";
import { AssetForm } from "../asset-form";

export const dynamic = "force-dynamic";

export default async function EditAssetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  if (!asset) notFound();

  // Se excluye el propio activo de la lista de padres posibles.
  const parents = await db
    .select({ id: assets.id, tag: assets.tag, name: assets.name })
    .from(assets)
    .where(ne(assets.id, id))
    .orderBy(asc(assets.tag));

  const action = updateAsset.bind(null, id);

  return (
    <>
      <PageHeader title={asset.name} subtitle={`${asset.tag} · editar ficha`} />
      <AssetForm action={action} asset={asset} parents={parents} />
    </>
  );
}
