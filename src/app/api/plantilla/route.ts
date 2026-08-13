import ExcelJS from "exceljs";
import { COLUMNS, type ColumnKey } from "@/lib/import/schema";
import { requireSessionOrUnauthorized } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Plantilla de importación con las cabeceras exactas, una fila de ejemplo y
 * una hoja de instrucciones. Entregar la plantilla evita la mitad de los
 * errores de formato antes de que ocurran.
 */
export async function GET() {
  // Los route handlers viven fuera del layout autenticado: si no comprueban
  // sesión por su cuenta, quedan abiertos a cualquiera.
  const { response } = await requireSessionOrUnauthorized();
  if (response) return response;

  const wb = new ExcelJS.Workbook();
  wb.creator = "GMAO-AI";
  wb.created = new Date();

  const sheet = wb.addWorksheet("Órdenes de trabajo");
  const keys = Object.keys(COLUMNS) as ColumnKey[];

  sheet.columns = keys.map((k) => ({
    header: COLUMNS[k].label,
    key: k,
    width: Math.max(14, COLUMNS[k].label.length + 4),
  }));

  const header = sheet.getRow(1);
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  header.alignment = { vertical: "middle" };
  header.height = 22;

  // Las obligatorias van marcadas para que se vean de un vistazo.
  keys.forEach((k, i) => {
    if (COLUMNS[k].required) {
      sheet.getCell(1, i + 1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF1D4ED8" },
      };
      sheet.getCell(1, i + 1).value = `${COLUMNS[k].label} *`;
    }
  });

  sheet.addRow({
    codigo: "",
    tag_activo: "EQ-102",
    tipo: "correctivo",
    estado: "cerrada",
    prioridad: 2,
    titulo: "Fuga en sello mecánico de bomba de zinc",
    descripcion: "Detectado por operaciones en el turno noche.",
    modo_falla: "Fuga en sello mecánico",
    responsable: "lramirez@galvanica.pe",
    reportado: "15/03/2026 08:30",
    inicio: "15/03/2026 09:15",
    fin: "15/03/2026 14:00",
    minutos_parada: 320,
    horas_estimadas: 4,
    horas_reales: 4.75,
    costo_mo: 133,
    costo_repuestos: 480,
  });
  sheet.getRow(2).font = { italic: true, color: { argb: "FF7C89A8" } };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const help = wb.addWorksheet("Instrucciones");
  help.columns = [
    { header: "Columna", key: "col", width: 24 },
    { header: "Obligatoria", key: "req", width: 13 },
    { header: "Notas", key: "hint", width: 62 },
  ];
  help.getRow(1).font = { bold: true };
  for (const k of keys) {
    help.addRow({
      col: COLUMNS[k].label,
      req: COLUMNS[k].required ? "Sí" : "No",
      hint: COLUMNS[k].hint,
    });
  }
  help.addRow({});
  help.addRow({
    col: "Fila 2 de la plantilla",
    req: "",
    hint: "Es un ejemplo: bórrala antes de importar tus datos.",
  });
  help.addRow({
    col: "Códigos duplicados",
    req: "",
    hint: "Si el código ya existe en el sistema, la fila se omite en vez de duplicarse.",
  });
  help.addRow({
    col: "Fechas",
    req: "",
    hint: "Se aceptan dd/mm/aaaa, aaaa-mm-dd y el formato de fecha nativo de Excel.",
  });

  const buffer = await wb.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-ordenes-trabajo.xlsx"',
    },
  });
}
