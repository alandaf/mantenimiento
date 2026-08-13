import {
  Document,
  Page,
  renderToBuffer,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { longDateTimeFmt, money } from "@/lib/config";
import type { MonthlyReport } from "./monthly";

/**
 * Reporte mensual en PDF. Se imprime en blanco y negro con frecuencia, así que
 * la jerarquía se apoya en peso tipográfico y reglas, no solo en color.
 */

const C = {
  ink: "#0f1524",
  muted: "#6b7280",
  line: "#d8dde7",
  brand: "#1d4ed8",
  bad: "#b91c1c",
  ok: "#047857",
  soft: "#f4f6fa",
};

const s = StyleSheet.create({
  page: {
    paddingTop: 38,
    paddingBottom: 48,
    paddingHorizontal: 40,
    fontSize: 9,
    color: C.ink,
    fontFamily: "Helvetica",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    borderBottomWidth: 2,
    borderBottomColor: C.brand,
    paddingBottom: 8,
    marginBottom: 16,
  },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold" },
  subtitle: { fontSize: 9, color: C.muted, marginTop: 3 },
  org: { fontSize: 11, fontFamily: "Helvetica-Bold", color: C.brand },
  orgSub: { fontSize: 7.5, color: C.muted, textAlign: "right", marginTop: 2 },

  sectionTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 7,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },

  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 4 },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 3,
    paddingVertical: 8,
    paddingHorizontal: 9,
  },
  kpiLabel: { fontSize: 6.5, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3 },
  kpiFoot: { fontSize: 6.5, color: C.muted, marginTop: 2 },

  table: { borderWidth: 1, borderColor: C.line, borderRadius: 3 },
  th: {
    flexDirection: "row",
    backgroundColor: C.soft,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingVertical: 5,
    paddingHorizontal: 7,
  },
  thText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: C.muted, textTransform: "uppercase" },
  tr: {
    flexDirection: "row",
    paddingVertical: 4.5,
    paddingHorizontal: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  td: { fontSize: 8 },
  right: { textAlign: "right" },
  bold: { fontFamily: "Helvetica-Bold" },
  note: { fontSize: 7.5, color: C.muted, marginTop: 5, lineHeight: 1.4 },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingTop: 6,
    fontSize: 7,
    color: C.muted,
  },
});

const TREND_LABEL: Record<string, string> = {
  acelerando: "Acelerando",
  estable: "Estable",
  desacelerando: "Desacelerando",
  indeterminada: "Serie corta",
};

function Cell({
  children,
  width,
  right,
  bold,
  color,
}: {
  children: React.ReactNode;
  width: string | number;
  right?: boolean;
  bold?: boolean;
  color?: string;
}) {
  return (
    <Text
      style={[
        s.td,
        { width },
        right ? s.right : {},
        bold ? s.bold : {},
        color ? { color } : {},
      ]}
    >
      {children}
    </Text>
  );
}

export function MonthlyReportPdf({ data }: { data: MonthlyReport }) {
  const f = data.formatted;
  const fmtDate = longDateTimeFmt;

  return (
    <Document
      title={`Reporte de mantenimiento — ${data.monthLabel}`}
      author="SIMARP"
    >
      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.title}>Reporte de mantenimiento</Text>
            <Text style={s.subtitle}>
              {data.monthLabel.charAt(0).toUpperCase() + data.monthLabel.slice(1)}
            </Text>
          </View>
          <View>
            <Text style={s.org}>{data.installation.name}</Text>
            {data.installation.location && (
              <Text style={s.orgSub}>{data.installation.location}</Text>
            )}
          </View>
        </View>

        {/* Indicadores */}
        <Text style={s.sectionTitle}>Indicadores clave</Text>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>MTTR</Text>
            <Text style={s.kpiValue}>{f.mttr}</Text>
            <Text style={s.kpiFoot}>Tiempo medio de reparación</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>MTBF</Text>
            <Text style={s.kpiValue}>{f.mtbf}</Text>
            <Text style={s.kpiFoot}>{data.summary.failureCount} fallas</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Disponibilidad</Text>
            <Text style={s.kpiValue}>{f.availability}</Text>
            <Text style={s.kpiFoot}>Operacional</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Cumplimiento PMP</Text>
            <Text style={s.kpiValue}>{f.pmCompliance}</Text>
            <Text style={s.kpiFoot}>Preventivas del plan</Text>
          </View>
        </View>
        <View style={s.kpiRow}>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Trabajo reactivo</Text>
            <Text style={s.kpiValue}>{f.reactive}</Text>
            <Text style={s.kpiFoot}>Horas correctivas / total</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Backlog</Text>
            <Text style={s.kpiValue}>{f.backlog}</Text>
            <Text style={s.kpiFoot}>{data.summary.openWorkOrders} OT abiertas</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>OT abiertas / cerradas</Text>
            <Text style={s.kpiValue}>
              {data.opened} / {data.closed}
            </Text>
            <Text style={s.kpiFoot}>En el mes</Text>
          </View>
          <View style={s.kpi}>
            <Text style={s.kpiLabel}>Costo del periodo</Text>
            <Text style={s.kpiValue}>{money.format(data.summary.totalCost)}</Text>
            <Text style={s.kpiFoot}>Mano de obra + repuestos</Text>
          </View>
        </View>

        {/* Distribución */}
        <Text style={s.sectionTitle}>Distribución de órdenes de trabajo</Text>
        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.thText, { width: "40%" }]}>Tipo</Text>
            <Text style={[s.thText, { width: "20%" }, s.right]}>Órdenes</Text>
            <Text style={[s.thText, { width: "20%" }, s.right]}>Horas</Text>
            <Text style={[s.thText, { width: "20%" }, s.right]}>% del total</Text>
          </View>
          {data.mix.map((m) => {
            const total = data.mix.reduce((a, b) => a + b.count, 0) || 1;
            return (
              <View key={m.type} style={s.tr}>
                <Cell width="40%" bold>
                  {m.type.charAt(0).toUpperCase() + m.type.slice(1)}
                </Cell>
                <Cell width="20%" right>{m.count}</Cell>
                <Cell width="20%" right>{Math.round(m.hours)} h</Cell>
                <Cell width="20%" right>
                  {((m.count / total) * 100).toFixed(0)}%
                </Cell>
              </View>
            );
          })}
        </View>

        {/* Pareto */}
        <Text style={s.sectionTitle}>Pareto de modos de falla</Text>
        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.thText, { width: "42%" }]}>Modo de falla</Text>
            <Text style={[s.thText, { width: "20%" }]}>Categoría</Text>
            <Text style={[s.thText, { width: "13%" }, s.right]}>Eventos</Text>
            <Text style={[s.thText, { width: "13%" }, s.right]}>Parada</Text>
            <Text style={[s.thText, { width: "12%" }, s.right]}>% impacto</Text>
          </View>
          {data.pareto.length === 0 ? (
            <View style={s.tr}>
              <Cell width="100%" color={C.muted}>
                Sin fallas con modo identificado en el periodo.
              </Cell>
            </View>
          ) : (
            data.pareto.map((p) => (
              <View key={p.label} style={s.tr}>
                <Cell width="42%" bold={p.isVital} color={p.isVital ? C.bad : undefined}>
                  {p.isVital ? "• " : "  "}
                  {p.label}
                </Cell>
                <Cell width="20%" color={C.muted}>{p.category}</Cell>
                <Cell width="13%" right>{p.occurrences}</Cell>
                <Cell width="13%" right>{Math.round(p.value)} h</Cell>
                <Cell width="12%" right>{p.percentage.toFixed(0)}%</Cell>
              </View>
            ))
          )}
        </View>
        <Text style={s.note}>
          • Los marcados concentran el 80% de las horas de parada: son los pocos
          vitales sobre los que conviene actuar primero.
        </Text>

        <View style={s.footer} fixed>
          <Text>
            Generado el {fmtDate.format(data.generatedAt)} · PMS SIMARP
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <View style={s.header} fixed>
          <View>
            <Text style={s.title}>Reporte de mantenimiento</Text>
            <Text style={s.subtitle}>
              {data.monthLabel.charAt(0).toUpperCase() + data.monthLabel.slice(1)}
            </Text>
          </View>
          <View>
            <Text style={s.org}>{data.installation.name}</Text>
            {data.installation.location && (
              <Text style={s.orgSub}>{data.installation.location}</Text>
            )}
          </View>
        </View>

        {/* Malos actores */}
        <Text style={s.sectionTitle}>Activos con mayor impacto</Text>
        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.thText, { width: "34%" }]}>Activo</Text>
            <Text style={[s.thText, { width: "10%" }]}>Crit.</Text>
            <Text style={[s.thText, { width: "11%" }, s.right]}>Fallas</Text>
            <Text style={[s.thText, { width: "12%" }, s.right]}>MTTR</Text>
            <Text style={[s.thText, { width: "13%" }, s.right]}>Parada</Text>
            <Text style={[s.thText, { width: "20%" }, s.right]}>Costo</Text>
          </View>
          {data.badActors.length === 0 ? (
            <View style={s.tr}>
              <Cell width="100%" color={C.muted}>
                Sin fallas registradas en el periodo.
              </Cell>
            </View>
          ) : (
            data.badActors.map((a) => (
              <View key={a.assetId} style={s.tr}>
                <Cell width="34%">
                  <Text style={s.bold}>{a.tag}</Text> {a.name}
                </Cell>
                <Cell width="10%" color={a.criticality === "A" ? C.bad : undefined} bold>
                  {a.criticality}
                </Cell>
                <Cell width="11%" right>{a.failures}</Cell>
                <Cell width="12%" right>
                  {a.mttrHours === null ? "—" : `${a.mttrHours.toFixed(1)} h`}
                </Cell>
                <Cell width="13%" right>{Math.round(a.downtimeHours)} h</Cell>
                <Cell width="20%" right>{money.format(a.cost)}</Cell>
              </View>
            ))
          )}
        </View>

        {/* Patrones repetitivos */}
        <Text style={s.sectionTitle}>Fallas repetitivas detectadas</Text>
        <View style={s.table}>
          <View style={s.th}>
            <Text style={[s.thText, { width: "20%" }]}>Activo</Text>
            <Text style={[s.thText, { width: "34%" }]}>Modo de falla</Text>
            <Text style={[s.thText, { width: "14%" }]}>Cronicidad</Text>
            <Text style={[s.thText, { width: "14%" }, s.right]}>Eventos</Text>
            <Text style={[s.thText, { width: "18%" }, s.right]}>Tendencia</Text>
          </View>
          {data.patterns.length === 0 ? (
            <View style={s.tr}>
              <Cell width="100%" color={C.muted}>
                No se detectaron fallas repetitivas en los últimos 12 meses.
              </Cell>
            </View>
          ) : (
            data.patterns.map((p) => (
              <View key={`${p.assetTag}-${p.failureMode}`} style={s.tr}>
                <Cell width="20%" bold>{p.assetTag}</Cell>
                <Cell width="34%">{p.failureMode}</Cell>
                <Cell
                  width="14%"
                  color={p.band === "cronica" ? C.bad : undefined}
                  bold={p.band === "cronica"}
                >
                  {p.band === "cronica" ? "Crónica" : "Recurrente"}
                </Cell>
                <Cell width="14%" right>{p.occurrences}</Cell>
                <Cell
                  width="18%"
                  right
                  color={p.trend === "acelerando" ? C.bad : C.muted}
                >
                  {TREND_LABEL[p.trend] ?? p.trend}
                </Cell>
              </View>
            ))
          )}
        </View>
        <Text style={s.note}>
          La tendencia requiere al menos cuatro eventos para calcularse; con menos
          se informa como serie corta en lugar de estimar una pendiente sobre ruido.
        </Text>

        {/* Metodología */}
        <Text style={s.sectionTitle}>Cómo se calculan estos indicadores</Text>
        <Text style={s.note}>
          MTTR = suma de (fin - inicio) dividida entre el número de correctivas
          cerradas. MTBF = horas operativas dividido entre número de fallas; se usa
          tiempo operativo y no calendario, porque un activo detenido no puede
          fallar. Disponibilidad operacional = (calendario - parada) / calendario.
          Cumplimiento PMP = preventivas ejecutadas sobre programadas. Un indicador
          sin datos suficientes se informa como «—» en lugar de cero.
        </Text>

        <View style={s.footer} fixed>
          <Text>
            Generado el {fmtDate.format(data.generatedAt)} · PMS SIMARP
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Página ${pageNumber} de ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

/**
 * Renderiza el reporte a un buffer. Vive aquí y no en el route handler porque
 * los handlers de Next deben llamarse route.ts, donde no se puede usar JSX.
 */
export function renderMonthlyReportPdf(data: MonthlyReport) {
  return renderToBuffer(<MonthlyReportPdf data={data} />);
}
