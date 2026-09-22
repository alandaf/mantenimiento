import { readFile } from "node:fs/promises";
import path from "node:path";
import { eq, sql } from "drizzle-orm";
import { db } from "../index";
import { assets, attachments, type NewAttachment } from "../schema";
import { guardarArchivo } from "../../lib/storage";

/**
 * Documentos de la demostración GLP.
 *
 * Los manuales son **enlaces** a los documentos publicados por cada
 * fabricante, no copias: son suyos, y el enlace lleva a su versión vigente.
 * El plano, el gráfico y el informe los genera `scripts/generar-adjuntos-demo.py`
 * y van marcados como documento de demostración.
 */

const QUIEN = "Carga de demostración";

const ENLACES: Array<{ tags: string[]; category: NewAttachment["category"]; title: string; url: string }> = [
  {
    tags: ["P-201A", "P-201B"],
    category: "manual",
    title: "Blackmer LGL · Manual de instalación, operación y mantenimiento 501-K00 (español)",
    url: "https://www.psgdover.com/docs/default-source/blackmer-docs/obsolete-models/ioms/501-k00_es.pdf?sfvrsn=8fcab939_13",
  },
  {
    tags: ["P-201A", "P-201B"],
    category: "repuestos",
    title: "Blackmer LGL · Lista de repuestos 501-K01",
    url: "https://www.psgdover.com/docs/default-source/blackmer-docs/obsolete-models/parts-lists/501-k01.pdf?sfvrsn=7d8f3231_11",
  },
  {
    tags: ["P-401B"],
    category: "manual",
    title: "Corken serie Z · Manual de instalación, operación y mantenimiento",
    url: "https://corken.com/wp-content/uploads/2022/02/id105.pdf",
  },
  {
    tags: ["LT-201", "LT-202", "LT-203"],
    category: "ficha_tecnica",
    title: "Rosemount 5408 · Hoja de datos del producto",
    url: "https://www.emerson.com/documents/automation/product-data-sheet-rosemount-5408-5408-sis-level-transmitters-en-202468.pdf",
  },
  {
    tags: ["LT-201", "LT-202", "LT-203"],
    category: "manual",
    title: "Rosemount 5408:SIS · Manual de seguridad",
    url: "https://www.emerson.com/documents/automation/safety-manual-rosemount-5408-sis-level-transmitter-en-7236740.pdf",
  },
];

async function idsPorTag(orgId: string): Promise<Map<string, number>> {
  const filas = await db
    .select({ id: assets.id, tag: assets.tag })
    .from(assets)
    .where(eq(assets.organizationId, orgId));
  return new Map(filas.map((f) => [f.tag, f.id]));
}

async function archivo(
  orgId: string,
  nombre: string,
  mime: string,
): Promise<Pick<NewAttachment, "storagePath" | "fileName" | "mimeType" | "sizeBytes">> {
  // Relativo a la raíz del proyecto y no a `__dirname`, que no existe si el
  // script corre como módulo ES.
  const bytes = await readFile(path.join(process.cwd(), "src", "db", "seeds", "adjuntos", nombre));
  return {
    storagePath: await guardarArchivo(orgId, mime, bytes),
    fileName: nombre,
    mimeType: mime,
    sizeBytes: bytes.length,
  };
}

export async function sembrarAdjuntosGlp(orgId: string): Promise<void> {
  const porTag = await idsPorTag(orgId);
  const filas: NewAttachment[] = [];

  for (const e of ENLACES) {
    for (const tag of e.tags) {
      const id = porTag.get(tag);
      if (!id) continue;
      filas.push({
        organizationId: orgId,
        entity: "activo",
        entityId: id,
        kind: "enlace",
        category: e.category,
        title: e.title,
        url: e.url,
        uploadedBy: QUIEN,
      });
    }
  }

  // El plano del área, en el nodo del área y en las dos bombas: quien mira la
  // bomba necesita ver de dónde succiona y adónde descarga.
  const plano = await archivo(orgId, "pid-area-200.pdf", "application/pdf");
  for (const tag of ["200", "P-201A", "P-201B"]) {
    const id = porTag.get(tag);
    if (!id) continue;
    filas.push({
      organizationId: orgId,
      entity: "activo",
      entityId: id,
      kind: "archivo",
      category: "plano",
      title: "P&ID simplificado · Área 200 (PGLP-200-PID-001 rev. B)",
      ...plano,
      uploadedBy: QUIEN,
    });
  }

  // La evidencia del tercer evento de la P-201A: el que por fin mide la
  // desalineación. Se busca por título, que es el del guion.
  const [orden] = (await db.execute(sql`
    SELECT w.id FROM work_orders w
    JOIN assets a ON a.id = w.asset_id
    WHERE w.organization_id = ${orgId} AND a.tag = 'P-201A'
      AND w.title = 'Detención de Bomba de transferencia A por vibración'
    ORDER BY w.reported_at DESC LIMIT 1
  `)) as unknown as Array<{ id: number }>;

  if (orden) {
    filas.push(
      {
        organizationId: orgId,
        entity: "orden_trabajo",
        entityId: orden.id,
        kind: "archivo",
        category: "informe",
        title: "Informe de alineamiento láser P-201A / M-201A",
        ...(await archivo(orgId, "informe-alineamiento-p201a.pdf", "application/pdf")),
        uploadedBy: QUIEN,
      },
      {
        organizationId: orgId,
        entity: "orden_trabajo",
        entityId: orden.id,
        kind: "archivo",
        category: "informe",
        title: "Tendencia de vibración de los tres eventos",
        ...(await archivo(orgId, "tendencia-vibracion-p201a.png", "image/png")),
        uploadedBy: QUIEN,
      },
    );
  }

  if (filas.length > 0) await db.insert(attachments).values(filas);
  console.log(`  ${filas.length} documentos adjuntos (${ENLACES.length} manuales enlazados)`);
}
