import ExcelJS from "exceljs";
import {
  mapHeaders,
  type ColumnKey,
  type RawRow,
} from "./schema";

/**
 * Lectura de la hoja de cálculo. Solo extrae y normaliza tipos crudos; la
 * validación de negocio vive en validate.ts.
 */

export type ParsedSheet = {
  sheetName: string;
  headers: string[];
  mapping: Partial<Record<ColumnKey, number>>;
  unknownColumns: string[];
  rows: RawRow[];
};

/**
 * Excel guarda las fechas como número de serie, pero también es muy común que
 * lleguen como texto ("15/03/2026", "2026-03-15"). Se cubren ambos casos y el
 * formato peruano día/mes, que es el que usa la planta.
 */
export function coerceDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;

  if (typeof value === "number") {
    // Serial de Excel: días desde 1899-12-30 (el desfase incluye el bug del
    // año bisiesto 1900 que Excel arrastra por compatibilidad con Lotus).
    if (value <= 0) return null;
    const ms = Math.round((value - 25569) * 86_400_000);
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const text = String(value).trim();
  if (!text) return null;

  // dd/mm/yyyy o dd-mm-yyyy, con hora opcional.
  const dmy = text.match(
    /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:[\sT](\d{1,2}):(\d{2}))?/,
  );
  if (dmy) {
    const [, d, m, y, hh = "0", mm = "0"] = dmy;
    const date = new Date(
      Date.UTC(+y, +m - 1, +d, +hh, +mm),
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const iso = new Date(text);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/** Números que llegan como "1.234,50" o "S/ 1,234.50". */
export function coerceNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  let text = String(value).replace(/[^\d,.-]/g, "").trim();
  if (!text) return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  if (lastComma > lastDot) {
    // Formato europeo: la coma es el separador decimal.
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }

  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** Valor de celda a texto plano, resolviendo fórmulas y celdas enriquecidas. */
function cellText(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object") {
    const v = value as unknown as Record<string, unknown>;
    if ("text" in v) return v.text;
    if ("result" in v) return v.result;
    if ("richText" in v) {
      return (v.richText as Array<{ text: string }>).map((r) => r.text).join("");
    }
    if ("hyperlink" in v && "text" in v) return v.text;
    return null;
  }
  return value;
}

const DATE_COLUMNS: ColumnKey[] = ["reportado", "inicio", "fin"];
const NUMBER_COLUMNS: ColumnKey[] = [
  "prioridad",
  "minutos_parada",
  "horas_estimadas",
  "horas_reales",
  "costo_mo",
  "costo_repuestos",
];

export async function parseWorkbook(buffer: ArrayBuffer): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  const sheet = wb.worksheets[0];
  if (!sheet) throw new Error("El archivo no contiene ninguna hoja.");

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cellText(cell.value) ?? "").trim();
  });

  const { mapping, unknown } = mapHeaders(headers);
  const rows: RawRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const raw: RawRow = { _row: rowNumber };
    let hasContent = false;

    for (const [key, index] of Object.entries(mapping) as Array<
      [ColumnKey, number]
    >) {
      const value = cellText(row.getCell(index + 1).value);
      if (value === null || value === undefined || value === "") continue;
      hasContent = true;

      if (DATE_COLUMNS.includes(key)) {
        raw[key] = coerceDate(value);
      } else if (NUMBER_COLUMNS.includes(key)) {
        raw[key] = coerceNumber(value);
      } else {
        raw[key] = String(value).trim();
      }
    }

    // Una fila con celdas vacías o solo espacios no es un error, es relleno.
    if (hasContent) rows.push(raw);
  });

  return {
    sheetName: sheet.name,
    headers: headers.filter(Boolean),
    mapping,
    unknownColumns: unknown,
    rows,
  };
}
