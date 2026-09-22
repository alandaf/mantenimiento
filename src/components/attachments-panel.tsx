import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { attachments } from "@/db/schema";
import { Panel } from "@/components/ui";
import { AttachmentForm, RetireButton } from "@/components/attachment-form";
import { getFormatters } from "@/lib/config";
import { getActiveOrgId } from "@/lib/org";

const CATEGORIA: Record<string, string> = {
  manual: "Manual",
  plano: "Plano",
  ficha_tecnica: "Ficha técnica",
  repuestos: "Repuestos",
  foto: "Foto",
  informe: "Informe",
  certificado: "Certificado",
  otro: "Documento",
};

function peso(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

/**
 * Documentos de un activo o de una orden.
 *
 * Las fotos se muestran como miniatura: una foto de evidencia que hay que
 * abrir para saber qué es no la mira nadie.
 */
export async function AttachmentsPanel({
  entidad,
  entidadId,
  hint,
}: {
  entidad: "activo" | "orden_trabajo";
  entidadId: number;
  hint?: string;
}) {
  const orgId = await getActiveOrgId();
  const [filas, { dateFmt }] = await Promise.all([
    db
      .select()
      .from(attachments)
      .where(
        and(
          eq(attachments.organizationId, orgId),
          eq(attachments.entity, entidad),
          eq(attachments.entityId, entidadId),
          isNull(attachments.retiredAt),
        ),
      )
      .orderBy(asc(attachments.category), asc(attachments.uploadedAt)),
    getFormatters(),
  ]);

  const fotos = filas.filter((f) => f.kind === "archivo" && f.mimeType?.startsWith("image/"));
  const documentos = filas.filter((f) => !fotos.includes(f));

  return (
    <Panel title="Documentos" hint={hint ?? `${filas.length} adjuntos`}>
      {filas.length === 0 && (
        <p className="px-5 py-4 text-[11px] text-ink-500">Sin documentos adjuntos.</p>
      )}

      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 px-5 pt-4">
          {fotos.map((f) => (
            <a
              key={f.id}
              href={`/api/adjuntos/${f.id}`}
              target="_blank"
              rel="noopener"
              className="group block overflow-hidden rounded-md border border-ink-800"
              title={f.title}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/adjuntos/${f.id}`}
                alt={f.title}
                loading="lazy"
                className="aspect-square w-full object-cover transition group-hover:opacity-80"
              />
              <span className="block truncate px-1.5 py-1 text-[10px] text-ink-400">{f.title}</span>
            </a>
          ))}
        </div>
      )}

      {documentos.length > 0 && (
        <ul className="divide-y divide-ink-800">
          {documentos.map((f) => (
            <li key={f.id} className="flex items-start gap-3 px-5 py-3">
              <span className="mt-0.5 shrink-0 rounded bg-ink-700 px-1.5 py-0.5 text-[10px] font-medium text-ink-300">
                {CATEGORIA[f.category]}
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={f.kind === "enlace" ? f.url! : `/api/adjuntos/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-300 hover:underline"
                >
                  {f.title}
                  {f.kind === "enlace" && " ↗"}
                </a>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {f.kind === "enlace"
                    ? `Documento del fabricante · ${new URL(f.url!).hostname.replace(/^www\./, "")}`
                    : `${peso(f.sizeBytes)} · ${f.uploadedBy} · ${dateFmt.format(f.uploadedAt)}`}
                </p>
              </div>
              <RetireButton id={f.id} titulo={f.title} />
            </li>
          ))}
        </ul>
      )}

      {fotos.length > 0 && (
        <ul className="px-5 pb-1 pt-2">
          {fotos.map((f) => (
            <li key={f.id} className="flex items-center justify-between py-1 text-[11px] text-ink-500">
              <span className="truncate">
                {f.title} · {f.uploadedBy} · {dateFmt.format(f.uploadedAt)}
              </span>
              <RetireButton id={f.id} titulo={f.title} />
            </li>
          ))}
        </ul>
      )}

      <AttachmentForm entidad={entidad} entidadId={entidadId} />
    </Panel>
  );
}
