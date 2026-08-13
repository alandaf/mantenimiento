"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/session";
import { parseWorkbook } from "@/lib/import/parse";
import { COLUMNS, type ColumnKey } from "@/lib/import/schema";
import { commitRows, validateRows, type ValidationReport } from "@/lib/import/validate";

export type ImportState = {
  ok: boolean;
  message?: string;
  report?: Omit<ValidationReport, "valid"> & {
    validCount: number;
    sample: ValidationReport["valid"][number]["preview"][];
  };
  imported?: number;
};

const MAX_BYTES = 10 * 1024 * 1024;

export async function importWorkOrders(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  await requireRole("planificador");
  const file = formData.get("file");
  const confirm = formData.get("confirm") === "1";

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Selecciona un archivo .xlsx." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, message: "El archivo supera los 10 MB." };
  }
  if (!/\.xlsx$/i.test(file.name)) {
    return {
      ok: false,
      message: "Formato no soportado. Guarda la hoja como .xlsx y vuelve a subirla.",
    };
  }

  try {
    const sheet = await parseWorkbook(await file.arrayBuffer());

    if (sheet.rows.length === 0) {
      return { ok: false, message: "La hoja no tiene filas de datos bajo la cabecera." };
    }

    const report = await validateRows(sheet.rows, sheet.mapping, sheet.unknownColumns);

    if (report.missingColumns.length > 0) {
      const labels = report.missingColumns
        .map((c) => COLUMNS[c as ColumnKey].label)
        .join(", ");
      return {
        ok: false,
        message: `Faltan columnas obligatorias: ${labels}. Descarga la plantilla para ver el formato.`,
      };
    }

    const summary = {
      issues: report.issues,
      duplicates: report.duplicates,
      missingColumns: report.missingColumns,
      unknownColumns: report.unknownColumns,
      totalRows: report.totalRows,
      validCount: report.valid.length,
      sample: report.valid.slice(0, 10).map((v) => v.preview),
    };

    if (!confirm) {
      return {
        ok: true,
        report: summary,
        message: `${report.valid.length} de ${report.totalRows} filas listas para importar.`,
      };
    }

    if (report.valid.length === 0) {
      return { ok: false, report: summary, message: "No hay ninguna fila válida que importar." };
    }

    const imported = await commitRows(report.valid);
    revalidatePath("/ordenes");
    revalidatePath("/dashboard");
    revalidatePath("/causa-raiz");

    return {
      ok: true,
      imported,
      report: summary,
      message: `${imported} órdenes de trabajo importadas.`,
    };
  } catch (err) {
    console.error("Fallo al importar:", err);
    const raw = err instanceof Error ? err.message : String(err);
    if (/zip|corrupt|end of central directory/i.test(raw)) {
      return {
        ok: false,
        message: "El archivo no es un .xlsx válido. Si es un .xls antiguo, vuelve a guardarlo como .xlsx.",
      };
    }
    return { ok: false, message: "No se pudo procesar el archivo. Revisa los logs del contenedor web." };
  }
}
