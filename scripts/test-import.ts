/**
 * Prueba manual del pipeline de importación contra la base de datos real.
 * Genera un .xlsx deliberadamente sucio y lo pasa por parseWorkbook +
 * validateRows, sin insertar nada.
 *
 *   docker compose ... exec web pnpm tsx scripts/test-import.ts
 */
import ExcelJS from "exceljs";
import { sqlClient } from "../src/db";
import { parseWorkbook } from "../src/lib/import/parse";
import { validateRows } from "../src/lib/import/validate";

async function buildDirtyWorkbook(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const s = wb.addWorksheet("Hoja1");

  // Cabeceras "de la vida real": sinónimos, mayúsculas, tildes, una desconocida.
  s.addRow([
    "N° OT",
    "EQUIPO",
    "Tipo Mantenimiento",
    "Estado",
    "Trabajo",
    "Modo de Falla",
    "Técnico",
    "Fecha Solicitud",
    "Hora Inicio",
    "Hora Fin",
    "Tiempo Parada",
    "HH",
    "Costo Mano de Obra",
    "Centro de Costo",
  ]);

  const rows: unknown[][] = [
    // 2 — válida, formato peruano y moneda con símbolo
    ["", "EQ-102", "Correctiva", "Cerrada", "Fuga en sello mecánico de bomba",
      "Fuga en sello mecánico", "lramirez@galvanica.pe", "15/03/2026 08:30",
      "15/03/2026 09:15", "15/03/2026 14:00", 320, "4,75", "S/ 133.00", "CC-100"],
    // 3 — válida, fecha ISO y técnico por nombre
    ["", "EQ-201", "Preventivo", "Cerrada", "Inspección visual y lubricación",
      "", "Ana Quispe", "2026-04-02", "2026-04-02", "2026-04-02", 0, 3, 114, "CC-200"],
    // 4 — activo inexistente
    ["", "EQ-999", "Correctiva", "Abierta", "Falla en equipo fantasma",
      "Rodamiento desgastado", "", "10/05/2026", "", "", 0, 0, 0, ""],
    // 5 — correctiva sin modo de falla
    ["", "EQ-101", "Correctiva", "Abierta", "Ruido anormal en el horno",
      "", "", "12/05/2026", "", "", 0, 0, 0, ""],
    // 6 — fin anterior al inicio
    ["", "EQ-103", "Correctiva", "Cerrada", "Atasco en desbobinadora",
      "Correa rota o destensada", "", "01/06/2026 10:00", "01/06/2026 12:00",
      "01/06/2026 09:00", 60, 2, 56, ""],
    // 7 — cerrada sin fecha de fin
    ["", "EQ-104", "Preventivo", "Finalizada", "Cambio de filtros del compresor",
      "", "", "05/06/2026", "05/06/2026", "", 0, 2, 60, ""],
    // 8 — código duplicado contra la BD
    ["OT-2026-0001", "EQ-105", "Correctiva", "Abierta", "Prueba de código duplicado",
      "Sensor descalibrado", "", "06/06/2026", "", "", 0, 0, 0, ""],
    // 9 — título demasiado corto y tipo inválido
    ["", "EQ-106", "Urgente", "Abierta", "Ok", "", "", "07/06/2026", "", "", 0, 0, 0, ""],
    // 10 — fila vacía: debe ignorarse sin contar como error
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    // 11 — técnico inexistente
    ["", "EQ-301", "Preventivo", "Abierta", "Limpieza de torre de enfriamiento",
      "", "juan.perez@otra.pe", "08/06/2026", "", "", 0, 0, 0, ""],
  ];
  rows.forEach((r) => s.addRow(r));

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

async function main() {
  const buffer = await buildDirtyWorkbook();
  const sheet = await parseWorkbook(buffer);

  console.log(`\nHoja: ${sheet.sheetName}`);
  console.log(`Columnas reconocidas: ${Object.keys(sheet.mapping).join(", ")}`);
  console.log(`Columnas ignoradas:   ${sheet.unknownColumns.join(", ") || "—"}`);
  console.log(`Filas con contenido:  ${sheet.rows.length}`);

  const report = await validateRows(sheet.rows, sheet.mapping, sheet.unknownColumns);

  console.log(`\nVálidas:    ${report.valid.length}`);
  console.log(`Duplicadas: ${report.duplicates.length} ${report.duplicates.join(", ")}`);
  console.log(`Con error:  ${new Set(report.issues.map((i) => i.row)).size} filas\n`);

  for (const v of report.valid) {
    console.log(`  ✓ fila ${v.row}  ${v.preview.codigo}  ${v.preview.tag}  ${v.preview.tipo}  ${v.preview.reportado}`);
  }
  console.log();
  for (const i of report.issues) {
    console.log(`  ✗ fila ${i.row}  [${i.field}] ${i.message}`);
  }
  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sqlClient.end());
