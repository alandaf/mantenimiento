import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { findActiveOrgId } from "@/lib/org";
import { requireSessionOrUnauthorized } from "@/lib/session";
import { leerArchivo } from "@/lib/storage";

/**
 * Descarga de un adjunto.
 *
 * Los archivos no se sirven como estáticos: cada descarga pasa por aquí, que
 * comprueba la sesión y la instalación. Así, un enlace copiado a un plano de
 * la planta no abre nada fuera de ella, ni desde otra instalación.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { response } = await requireSessionOrUnauthorized();
  if (response) return response;

  const orgId = await findActiveOrgId();
  const id = Number((await params).id);
  if (!orgId || !Number.isInteger(id)) return new Response("No encontrado", { status: 404 });

  const [adj] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.organizationId, orgId)))
    .limit(1);
  if (!adj) return new Response("No encontrado", { status: 404 });

  if (adj.kind === "enlace" && adj.url) return Response.redirect(adj.url, 302);
  if (!adj.storagePath || !adj.mimeType) return new Response("No encontrado", { status: 404 });

  const bytes = await leerArchivo(adj.storagePath);
  const nombre = encodeURIComponent(adj.fileName ?? `adjunto-${adj.id}`);
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": adj.mimeType,
      // `inline`: el PDF y la foto se ven en el navegador, sin descargar.
      "Content-Disposition": `inline; filename*=UTF-8''${nombre}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
