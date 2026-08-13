import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
import { assets, failureModes, technicians, workOrders } from "@/db/schema";
import { normalizeHeader } from "./schema";
import { importRowSchema, type ColumnKey, type RawRow } from "./schema";

/**
 * Validación de negocio: lo que Zod no puede saber por sí solo — si el activo
 * existe, si el modo de falla está en el catálogo, si el código ya se usó.
 *
 * El resultado es un informe fila por fila. Un importador que falla entero por
 * una celda mala es inservible con datos reales: aquí las filas válidas se
 * importan y las inválidas se listan con su motivo y su número de fila del
 * Excel, para corregirlas en el archivo original.
 */

export type RowIssue = {
  row: number;
  field: string;
  message: string;
};

export type ValidRow = {
  row: number;
  values: typeof workOrders.$inferInsert;
  /** Para mostrar en la vista previa sin volver a consultar. */
  preview: {
    codigo: string;
    tag: string;
    tipo: string;
    titulo: string;
    reportado: string;
  };
};

export type ValidationReport = {
  valid: ValidRow[];
  issues: RowIssue[];
  duplicates: string[];
  missingColumns: string[];
  unknownColumns: string[];
  totalRows: number;
};

const REQUIRED_COLUMNS: ColumnKey[] = ["tag_activo", "tipo", "titulo", "reportado"];

/** Catálogos indexados por clave normalizada, para tolerar mayúsculas y tildes. */
async function loadCatalogs(orgId: string) {
  const [assetRows, modeRows, techRows, codeRows] = await Promise.all([
    db.select({ id: assets.id, tag: assets.tag }).from(assets).where(eq(assets.organizationId, orgId)),
    db.select({ id: failureModes.id, name: failureModes.name, code: failureModes.code }).from(failureModes).where(eq(failureModes.organizationId, orgId)),
    db.select({ id: technicians.id, name: technicians.name, email: technicians.email }).from(technicians).where(eq(technicians.organizationId, orgId)),
    db.select({ code: workOrders.code }).from(workOrders).where(eq(workOrders.organizationId, orgId)).orderBy(asc(workOrders.code)),
  ]);

  return {
    assetsByTag: new Map(assetRows.map((a) => [normalizeHeader(a.tag), a.id])),
    modesByName: new Map([
      ...modeRows.map((m) => [normalizeHeader(m.name), m.id] as const),
      ...modeRows.map((m) => [normalizeHeader(m.code), m.id] as const),
    ]),
    techsByKey: new Map([
      ...techRows.map((t) => [normalizeHeader(t.name), t.id] as const),
      ...techRows.map((t) => [normalizeHeader(t.email), t.id] as const),
    ]),
    existingCodes: new Set(codeRows.map((c) => c.code)),
  };
}

/** Siguiente correlativo disponible, para las filas sin código. */
async function nextCodeSequence(orgId: string): Promise<{ year: number; next: number }> {
  const year = new Date().getFullYear();
  const [row] = (await db.execute(sql`
    SELECT COALESCE(MAX(SUBSTRING(code FROM 9)::int), 0) + 1 AS next
    FROM work_orders
    WHERE organization_id = ${orgId} AND code LIKE ${`OT-${year}-%`}
  `)) as unknown as Array<{ next: number }>;
  return { year, next: row.next };
}

export async function validateRows(
  rows: RawRow[],
  mapping: Partial<Record<ColumnKey, number>>,
  unknownColumns: string[],
): Promise<ValidationReport> {
  const orgId = await getActiveOrgId();
  const missingColumns = REQUIRED_COLUMNS.filter((c) => mapping[c] === undefined);

  if (missingColumns.length > 0) {
    return {
      valid: [],
      issues: [],
      duplicates: [],
      missingColumns,
      unknownColumns,
      totalRows: rows.length,
    };
  }

  const catalogs = await loadCatalogs(orgId);
  const seq = await nextCodeSequence(orgId);
  let counter = seq.next;

  const valid: ValidRow[] = [];
  const issues: RowIssue[] = [];
  const duplicates: string[] = [];
  // Detecta códigos repetidos dentro del propio archivo, no solo contra la BD.
  const seenInFile = new Set<string>();

  for (const raw of rows) {
    const parsed = importRowSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        issues.push({
          row: raw._row,
          field: String(issue.path[0] ?? "—"),
          message: issue.message,
        });
      }
      continue;
    }

    const data = parsed.data;
    const rowIssues: RowIssue[] = [];

    const assetId = catalogs.assetsByTag.get(normalizeHeader(data.tag_activo));
    if (!assetId) {
      rowIssues.push({
        row: raw._row,
        field: "tag_activo",
        message: `El activo "${data.tag_activo}" no existe en el sistema`,
      });
    }

    let failureModeId: number | null = null;
    if (data.modo_falla) {
      failureModeId = catalogs.modesByName.get(normalizeHeader(data.modo_falla)) ?? null;
      if (!failureModeId) {
        rowIssues.push({
          row: raw._row,
          field: "modo_falla",
          message: `El modo de falla "${data.modo_falla}" no está en el catálogo`,
        });
      }
    }
    if (data.tipo === "correctivo" && data.estado !== "anulada" && !failureModeId) {
      rowIssues.push({
        row: raw._row,
        field: "modo_falla",
        message: "Toda correctiva necesita un modo de falla para el análisis",
      });
    }

    let assignedTo: number | null = null;
    if (data.responsable) {
      assignedTo = catalogs.techsByKey.get(normalizeHeader(data.responsable)) ?? null;
      if (!assignedTo) {
        rowIssues.push({
          row: raw._row,
          field: "responsable",
          message: `No se encontró al técnico "${data.responsable}"`,
        });
      }
    }

    // Las mismas reglas temporales que valida el formulario: un MTTR negativo
    // envenenaría el tablero igual venga de la UI o de un Excel.
    if (data.inicio && data.inicio < data.reportado) {
      rowIssues.push({
        row: raw._row,
        field: "inicio",
        message: "El inicio no puede ser anterior al reporte",
      });
    }
    if (data.fin && !data.inicio) {
      rowIssues.push({
        row: raw._row,
        field: "inicio",
        message: "No se puede cerrar una OT que nunca inició",
      });
    }
    if (data.fin && data.inicio && data.fin < data.inicio) {
      rowIssues.push({
        row: raw._row,
        field: "fin",
        message: "El fin no puede ser anterior al inicio",
      });
    }
    if (data.estado === "cerrada" && !data.fin) {
      rowIssues.push({
        row: raw._row,
        field: "fin",
        message: "Una OT cerrada necesita fecha de fin",
      });
    }

    let code = data.codigo?.trim();
    if (code) {
      if (catalogs.existingCodes.has(code) || seenInFile.has(code)) {
        duplicates.push(code);
        continue; // Duplicado: se omite, no es un error a corregir.
      }
    } else {
      code = `OT-${seq.year}-${String(counter++).padStart(4, "0")}`;
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues);
      continue;
    }

    seenInFile.add(code);
    valid.push({
      row: raw._row,
      values: {
        organizationId: orgId,
        code,
        assetId: assetId!,
        type: data.tipo,
        status: data.estado,
        priority: data.prioridad,
        title: data.titulo,
        description: data.descripcion ?? null,
        failureModeId,
        assignedTo,
        reportedAt: data.reportado,
        startedAt: data.inicio,
        finishedAt: data.fin,
        downtimeMinutes: Math.round(data.minutos_parada),
        estimatedHours: data.horas_estimadas.toFixed(2),
        laborHours: data.horas_reales.toFixed(2),
        laborCost: data.costo_mo.toFixed(2),
        partsCost: data.costo_repuestos.toFixed(2),
      },
      preview: {
        codigo: code,
        tag: data.tag_activo,
        tipo: data.tipo,
        titulo: data.titulo,
        reportado: data.reportado.toISOString().slice(0, 10),
      },
    });
  }

  return {
    valid,
    issues,
    duplicates,
    missingColumns: [],
    unknownColumns,
    totalRows: rows.length,
  };
}

/**
 * Inserta las filas válidas en una sola transacción: o entra todo o no entra
 * nada. Una importación a medias deja el histórico en un estado que nadie sabe
 * reconciliar después.
 */
export async function commitRows(rows: ValidRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  await db.transaction(async (tx) => {
    // En lotes: un INSERT con miles de filas satura los parámetros del driver.
    const size = 200;
    for (let i = 0; i < rows.length; i += size) {
      await tx.insert(workOrders).values(rows.slice(i, i + size).map((r) => r.values));
    }
  });
  return rows.length;
}
