import type { NextRequest } from "next/server";
import { buildMonthlyReport } from "@/lib/report/monthly";
import { renderMonthlyReportPdf } from "@/lib/report/pdf";

export const dynamic = "force-dynamic";
// El renderizado de PDF necesita APIs de Node, no del runtime edge.
export const runtime = "nodejs";

/** GET /api/reportes/mensual?mes=2026-08 → PDF descargable. */
export async function GET(request: NextRequest) {
  const mes = request.nextUrl.searchParams.get("mes") ?? "";
  const match = mes.match(/^(\d{4})-(\d{2})$/);

  if (!match) {
    return Response.json(
      { error: "Parámetro 'mes' inválido. Formato esperado: AAAA-MM." },
      { status: 400 },
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) {
    return Response.json({ error: "Mes fuera de rango." }, { status: 400 });
  }

  try {
    const data = await buildMonthlyReport(year, month);
    const buffer = await renderMonthlyReportPdf(data);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="reporte-mantenimiento-${mes}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Fallo al generar el PDF:", err);
    return Response.json(
      { error: "No se pudo generar el reporte." },
      { status: 500 },
    );
  }
}
