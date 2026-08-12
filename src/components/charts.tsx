"use client";

import {
  Bar,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Recharts renderiza SVG: los colores van como literales, no como clases.
const C = {
  brand: "#2563eb",
  brandLight: "#60a5fa",
  ok: "#10b981",
  warn: "#f59e0b",
  bad: "#ef4444",
  grid: "#1a2338",
  axis: "#7c89a8",
  panel: "#141b2d",
};

const AXIS = { stroke: C.axis, fontSize: 11, tickLine: false, axisLine: false };

const TOOLTIP = {
  contentStyle: {
    background: C.panel,
    border: "1px solid #253049",
    borderRadius: 10,
    fontSize: 12,
  },
  labelStyle: { color: "#e4e9f2", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "#a3aec7" },
};

const MONTH_LABELS = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function monthLabel(iso: string): string {
  const month = Number(iso.slice(5, 7));
  return MONTH_LABELS[month - 1] ?? iso;
}

export function AvailabilityTrend({
  data,
}: {
  data: Array<{ month: string; availability: number | null; failures: number }>;
}) {
  const series = data.map((d) => ({
    label: monthLabel(d.month),
    disponibilidad: d.availability === null ? null : d.availability * 100,
    fallas: d.failures,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={series} margin={{ top: 12, right: 12, bottom: 4, left: -12 }}>
        <XAxis dataKey="label" {...AXIS} />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 20, 40, 60, 80, 100]}
          tickFormatter={(v) => `${v}%`}
          {...AXIS}
        />
        <Tooltip
          {...TOOLTIP}
          formatter={(value: number) => [`${value.toFixed(1)}%`, "Disponibilidad"]}
        />
        <Line
          type="monotone"
          dataKey="disponibilidad"
          stroke={C.brandLight}
          strokeWidth={2.5}
          dot={{ r: 3, fill: C.brand, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function ParetoChart({
  data,
}: {
  data: Array<{
    label: string;
    value: number;
    percentage: number;
    cumulative: number;
    isVital: boolean;
  }>;
}) {
  const top = data.slice(0, 8).map((d) => ({
    label: d.label.length > 22 ? `${d.label.slice(0, 21)}…` : d.label,
    horas: Math.round(d.value * 10) / 10,
    acumulado: Math.round(d.cumulative * 10) / 10,
    isVital: d.isVital,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ComposedChart
        data={top}
        layout="vertical"
        margin={{ top: 12, right: 16, bottom: 4, left: 8 }}
      >
        <XAxis type="number" {...AXIS} />
        <YAxis type="category" dataKey="label" width={150} {...AXIS} />
        <Tooltip
          {...TOOLTIP}
          formatter={(value: number, name: string) =>
            name === "horas"
              ? [`${value} h`, "Parada acumulada"]
              : [`${value}%`, "Acumulado"]
          }
        />
        <Bar dataKey="horas" radius={[0, 4, 4, 0]} barSize={16}>
          {top.map((entry, i) => (
            // Los "pocos vitales" (80% del impacto) se destacan en rojo.
            <Cell key={i} fill={entry.isVital ? C.bad : C.grid} />
          ))}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

const MIX_COLORS: Record<string, string> = {
  correctivo: C.bad,
  preventivo: C.ok,
  predictivo: C.brand,
  mejora: "#7c89a8",
};

export function WorkOrderMix({
  data,
}: {
  data: Array<{ type: string; count: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={data}
          dataKey="count"
          nameKey="type"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
          stroke="none"
        >
          {data.map((entry) => (
            <Cell key={entry.type} fill={MIX_COLORS[entry.type] ?? C.grid} />
          ))}
        </Pie>
        <Tooltip {...TOOLTIP} formatter={(v: number) => [`${v} OT`, ""]} />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value: string) => (
            <span style={{ color: C.axis, fontSize: 12, textTransform: "capitalize" }}>
              {value}
            </span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
