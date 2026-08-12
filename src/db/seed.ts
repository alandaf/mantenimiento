import { sql } from "drizzle-orm";
import { db, sqlClient } from "./index";
import {
  assets,
  failureModes,
  pmPlans,
  technicians,
  workOrders,
  type NewAsset,
  type NewWorkOrder,
} from "./schema";

/**
 * Seed determinista: mismo resultado en cada ejecución, para que los KPIs del
 * dashboard sean estables y los tests de integración reproducibles.
 */
let seedState = 20260817;
function rand(): number {
  // LCG (Numerical Recipes) — suficiente para datos de demostración.
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}
/** Elige con pesos: [[valor, peso], …]. */
function weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

const FAILURE_MODES = [
  { code: "FM-001", name: "Rodamiento desgastado", category: "mecanica" },
  { code: "FM-002", name: "Desalineamiento de acople", category: "mecanica" },
  { code: "FM-003", name: "Fuga en sello mecánico", category: "mecanica" },
  { code: "FM-004", name: "Correa rota o destensada", category: "mecanica" },
  { code: "FM-005", name: "Sobrecalentamiento de motor", category: "electrica" },
  { code: "FM-006", name: "Falla de variador de frecuencia", category: "electrica" },
  { code: "FM-007", name: "Contactor pegado", category: "electrica" },
  { code: "FM-008", name: "Sensor descalibrado", category: "instrumentacion" },
  { code: "FM-009", name: "Transmisor de presión sin señal", category: "instrumentacion" },
  { code: "FM-010", name: "Fuga en manguera hidráulica", category: "hidraulica" },
  { code: "FM-011", name: "Bomba hidráulica con baja presión", category: "hidraulica" },
  { code: "FM-012", name: "Electroválvula neumática trabada", category: "neumatica" },
  { code: "FM-013", name: "Fuga de aire comprimido", category: "neumatica" },
  { code: "FM-014", name: "Error de operación / mal seteo", category: "operacional" },
  { code: "FM-015", name: "Fisura en estructura soporte", category: "estructural" },
] as const;

const TECHNICIANS = [
  { name: "Carlos Mendoza", email: "cmendoza@galvanica.pe", role: "jefe", specialty: "Gestión", hourlyRate: 45 },
  { name: "Ana Quispe", email: "aquispe@galvanica.pe", role: "planificador", specialty: "Planificación", hourlyRate: 38 },
  { name: "Luis Ramírez", email: "lramirez@galvanica.pe", role: "tecnico", specialty: "Mecánica", hourlyRate: 28 },
  { name: "Jorge Huamán", email: "jhuaman@galvanica.pe", role: "tecnico", specialty: "Electricidad", hourlyRate: 30 },
  { name: "María Salazar", email: "msalazar@galvanica.pe", role: "tecnico", specialty: "Instrumentación", hourlyRate: 32 },
  { name: "Pedro Ccahuana", email: "pccahuana@galvanica.pe", role: "tecnico", specialty: "Mecánica", hourlyRate: 26 },
  { name: "Rosa Ivanov", email: "rivanov@galvanica.pe", role: "tecnico", specialty: "Hidráulica", hourlyRate: 29 },
  { name: "Diego Flores", email: "dflores@galvanica.pe", role: "tecnico", specialty: "Electricidad", hourlyRate: 27 },
] as const;

/** Planta → línea → equipo. Cada equipo trae su perfil de falla. */
const PLANT: Array<{
  line: { tag: string; name: string };
  equipment: Array<{
    tag: string;
    name: string;
    criticality: "A" | "B" | "C";
    manufacturer: string;
    model: string;
    downtimeCostPerHour: number;
    /** Fallas esperadas al año — controla el MTBF resultante. */
    failuresPerYear: number;
    /** Horas típicas de reparación [min, max]. */
    repairHours: [number, number];
  }>;
}> = [
  {
    line: { tag: "L-100", name: "Línea de Galvanizado 1" },
    equipment: [
      { tag: "EQ-101", name: "Horno de recocido", criticality: "A", manufacturer: "Andritz", model: "HR-4500", downtimeCostPerHour: 2800, failuresPerYear: 6, repairHours: [3, 14] },
      { tag: "EQ-102", name: "Bomba de zinc fundido", criticality: "A", manufacturer: "KSB", model: "Etanorm 125", downtimeCostPerHour: 2400, failuresPerYear: 11, repairHours: [2, 9] },
      { tag: "EQ-103", name: "Desbobinadora", criticality: "B", manufacturer: "Fagor", model: "DB-20", downtimeCostPerHour: 900, failuresPerYear: 5, repairHours: [1, 5] },
      { tag: "EQ-104", name: "Compresor de aire principal", criticality: "A", manufacturer: "Atlas Copco", model: "GA-90", downtimeCostPerHour: 1900, failuresPerYear: 8, repairHours: [2, 7] },
      { tag: "EQ-105", name: "Tanque de decapado", criticality: "B", manufacturer: "Fabricación local", model: "TD-3", downtimeCostPerHour: 700, failuresPerYear: 3, repairHours: [2, 8] },
      { tag: "EQ-106", name: "Rectificador de corriente", criticality: "A", manufacturer: "Siemens", model: "SINAMICS DCM", downtimeCostPerHour: 2100, failuresPerYear: 4, repairHours: [3, 12] },
    ],
  },
  {
    line: { tag: "L-200", name: "Línea de Galvanizado 2" },
    equipment: [
      { tag: "EQ-201", name: "Horno de secado", criticality: "B", manufacturer: "Andritz", model: "HS-2200", downtimeCostPerHour: 1500, failuresPerYear: 5, repairHours: [2, 10] },
      { tag: "EQ-202", name: "Bomba centrífuga de proceso", criticality: "B", manufacturer: "Grundfos", model: "NK-80", downtimeCostPerHour: 1100, failuresPerYear: 9, repairHours: [1.5, 6] },
      { tag: "EQ-203", name: "Sistema hidráulico de tensores", criticality: "A", manufacturer: "Bosch Rexroth", model: "HPU-45", downtimeCostPerHour: 1700, failuresPerYear: 10, repairHours: [2, 8] },
      { tag: "EQ-204", name: "Faja transportadora de salida", criticality: "C", manufacturer: "Habasit", model: "TC-12", downtimeCostPerHour: 350, failuresPerYear: 7, repairHours: [0.5, 3] },
      { tag: "EQ-205", name: "Rebobinadora", criticality: "B", manufacturer: "Fagor", model: "RB-20", downtimeCostPerHour: 950, failuresPerYear: 4, repairHours: [1, 5] },
    ],
  },
  {
    line: { tag: "L-300", name: "Servicios Auxiliares" },
    equipment: [
      { tag: "EQ-301", name: "Torre de enfriamiento", criticality: "B", manufacturer: "Evapco", model: "AT-118", downtimeCostPerHour: 800, failuresPerYear: 4, repairHours: [2, 9] },
      { tag: "EQ-302", name: "Caldera pirotubular", criticality: "A", manufacturer: "Cleaver-Brooks", model: "CB-200", downtimeCostPerHour: 2200, failuresPerYear: 3, repairHours: [4, 16] },
      { tag: "EQ-303", name: "Grupo electrógeno", criticality: "A", manufacturer: "Caterpillar", model: "C18", downtimeCostPerHour: 3000, failuresPerYear: 2, repairHours: [3, 12] },
      { tag: "EQ-304", name: "Planta de tratamiento de efluentes", criticality: "B", manufacturer: "Veolia", model: "PTE-50", downtimeCostPerHour: 600, failuresPerYear: 6, repairHours: [1, 6] },
      { tag: "EQ-305", name: "Puente grúa 10t", criticality: "C", manufacturer: "Demag", model: "EKKE-10", downtimeCostPerHour: 400, failuresPerYear: 3, repairHours: [1, 5] },
      { tag: "EQ-306", name: "Chiller de proceso", criticality: "B", manufacturer: "Carrier", model: "30XA-252", downtimeCostPerHour: 1000, failuresPerYear: 5, repairHours: [2, 7] },
    ],
  },
];

const PM_TEMPLATES = [
  { name: "Inspección visual y lubricación", frequencyDays: 30, estimatedHours: "2.00" },
  { name: "Análisis de vibraciones", frequencyDays: 90, estimatedHours: "3.50" },
  { name: "Termografía de tableros", frequencyDays: 90, estimatedHours: "2.50" },
  { name: "Cambio de aceite y filtros", frequencyDays: 180, estimatedHours: "5.00" },
  { name: "Overhaul mayor", frequencyDays: 365, estimatedHours: "24.00" },
];

const MONTHS_OF_HISTORY = 12;

async function main() {
  console.log("→ Limpiando tablas…");
  await db.execute(sql`
    TRUNCATE TABLE work_orders, pm_plans, ai_insights, assets, failure_modes, technicians
    RESTART IDENTITY CASCADE
  `);

  console.log("→ Modos de falla…");
  const modes = await db
    .insert(failureModes)
    .values(FAILURE_MODES.map((m) => ({ ...m })))
    .returning();

  console.log("→ Técnicos…");
  const techs = await db
    .insert(technicians)
    .values(TECHNICIANS.map((t) => ({ ...t })))
    .returning();
  const fieldTechs = techs.filter((t) => t.role === "tecnico");

  console.log("→ Activos…");
  const [plant] = await db
    .insert(assets)
    .values({
      tag: "PLT-01",
      name: "Planta Gálvanica Lurín",
      criticality: "A",
      location: "Lurín, Lima",
      status: "operando",
    })
    .returning();

  const equipmentRows: Array<{
    row: typeof assets.$inferSelect;
    profile: (typeof PLANT)[number]["equipment"][number];
  }> = [];

  for (const group of PLANT) {
    const [line] = await db
      .insert(assets)
      .values({
        tag: group.line.tag,
        name: group.line.name,
        parentId: plant.id,
        criticality: "A",
        location: "Lurín, Lima",
        status: "operando",
      })
      .returning();

    const inserted = await db
      .insert(assets)
      .values(
        group.equipment.map<NewAsset>((eq) => ({
          tag: eq.tag,
          name: eq.name,
          parentId: line.id,
          criticality: eq.criticality,
          status: "operando",
          location: group.line.name,
          manufacturer: eq.manufacturer,
          model: eq.model,
          serialNumber: `SN-${randInt(100000, 999999)}`,
          downtimeCostPerHour: eq.downtimeCostPerHour,
          installedAt: new Date(
            Date.UTC(randInt(2012, 2022), randInt(0, 11), randInt(1, 28)),
          ),
        })),
      )
      .returning();

    inserted.forEach((row, i) => {
      equipmentRows.push({ row, profile: group.equipment[i] });
    });
  }

  console.log("→ Planes preventivos…");
  const now = new Date();
  await db.insert(pmPlans).values(
    equipmentRows.flatMap(({ row, profile }) => {
      const count = profile.criticality === "A" ? 3 : profile.criticality === "B" ? 2 : 1;
      return PM_TEMPLATES.slice(0, count).map((tpl) => {
        const offsetDays = randInt(-tpl.frequencyDays, tpl.frequencyDays);
        return {
          assetId: row.id,
          name: tpl.name,
          frequencyDays: tpl.frequencyDays,
          estimatedHours: tpl.estimatedHours,
          lastExecutedAt: new Date(now.getTime() - randInt(5, 60) * 86_400_000),
          nextDueAt: new Date(now.getTime() + offsetDays * 86_400_000),
          active: true,
        };
      });
    }),
  );

  console.log("→ Órdenes de trabajo (12 meses)…");
  const horizonStart = new Date(now.getTime() - MONTHS_OF_HISTORY * 30 * 86_400_000);
  const horizonMs = now.getTime() - horizonStart.getTime();
  const orders: NewWorkOrder[] = [];
  let counter = 1;
  const nextCode = () => `OT-2026-${String(counter++).padStart(4, "0")}`;

  for (const { row, profile } of equipmentRows) {
    // --- Correctivas: distribuidas en el año según el perfil del equipo ---
    const failures = Math.max(1, Math.round(profile.failuresPerYear * (0.75 + rand() * 0.5)));
    for (let i = 0; i < failures; i++) {
      const reportedAt = new Date(horizonStart.getTime() + rand() * horizonMs);
      const mode = pick(modes);
      const priority = profile.criticality === "A" ? weighted([[1, 5], [2, 4], [3, 1]] as const)
        : profile.criticality === "B" ? weighted([[2, 4], [3, 5], [4, 1]] as const)
        : weighted([[3, 5], [4, 4]] as const);

      // Tiempo de respuesta: mayor prioridad, atención más rápida.
      const responseHours = priority === 1 ? rand() * 2 : priority === 2 ? rand() * 6 : rand() * 30;
      const [minRepair, maxRepair] = profile.repairHours;
      const repairHours = minRepair + rand() * (maxRepair - minRepair);

      const startedAt = new Date(reportedAt.getTime() + responseHours * 3_600_000);
      const finishedAt = new Date(startedAt.getTime() + repairHours * 3_600_000);
      // Las OT más recientes pueden seguir abiertas.
      const isClosed = finishedAt.getTime() < now.getTime() - 86_400_000 || rand() > 0.25;

      const tech = pick(fieldTechs);
      const laborHours = repairHours * (0.8 + rand() * 0.9);
      // La parada suele exceder la reparación: espera de repuestos, permisos.
      const downtimeMinutes = Math.round((responseHours + repairHours * (1 + rand() * 0.4)) * 60);

      orders.push({
        code: nextCode(),
        assetId: row.id,
        type: "correctivo",
        status: isClosed ? "cerrada" : weighted([["ejecucion", 3], ["asignada", 2], ["abierta", 2], ["pausada", 1]] as const),
        priority,
        title: `${mode.name} en ${row.name}`,
        description: `Reportado por operaciones. Modo de falla identificado: ${mode.name.toLowerCase()}.`,
        failureModeId: mode.id,
        assignedTo: tech.id,
        reportedAt,
        startedAt: isClosed ? startedAt : rand() > 0.4 ? startedAt : null,
        finishedAt: isClosed ? finishedAt : null,
        downtimeMinutes: isClosed ? downtimeMinutes : 0,
        estimatedHours: repairHours.toFixed(2),
        laborHours: isClosed ? laborHours.toFixed(2) : "0",
        laborCost: isClosed ? (laborHours * tech.hourlyRate).toFixed(2) : "0",
        partsCost: isClosed ? (rand() * profile.downtimeCostPerHour * 0.4).toFixed(2) : "0",
      });
    }

    // --- Preventivas: cadencia mensual/bimestral según criticidad ---
    const pmInterval = profile.criticality === "A" ? 30 : profile.criticality === "B" ? 45 : 90;
    for (let day = 10; day < MONTHS_OF_HISTORY * 30; day += pmInterval) {
      const reportedAt = new Date(horizonStart.getTime() + day * 86_400_000);
      if (reportedAt > now) break;
      // ~85% de cumplimiento: algunas preventivas se anulan por falta de ventana.
      const complied = rand() < 0.85;
      const durationHours = 1.5 + rand() * 4;
      const startedAt = new Date(reportedAt.getTime() + rand() * 12 * 3_600_000);
      const finishedAt = new Date(startedAt.getTime() + durationHours * 3_600_000);
      const tech = pick(fieldTechs);

      orders.push({
        code: nextCode(),
        assetId: row.id,
        type: "preventivo",
        status: complied ? "cerrada" : weighted([["anulada", 2], ["abierta", 1]] as const),
        priority: 3,
        title: `${pick(PM_TEMPLATES).name} — ${row.tag}`,
        description: "Ejecución de rutina del plan de mantenimiento preventivo.",
        assignedTo: tech.id,
        reportedAt,
        startedAt: complied ? startedAt : null,
        finishedAt: complied ? finishedAt : null,
        // El preventivo se hace en parada programada: no cuenta como indisponibilidad.
        downtimeMinutes: 0,
        estimatedHours: durationHours.toFixed(2),
        laborHours: complied ? durationHours.toFixed(2) : "0",
        laborCost: complied ? (durationHours * tech.hourlyRate).toFixed(2) : "0",
        partsCost: complied ? (rand() * 250).toFixed(2) : "0",
      });
    }

    // --- Predictivas en equipos críticos ---
    if (profile.criticality === "A") {
      for (let q = 0; q < 4; q++) {
        const reportedAt = new Date(horizonStart.getTime() + (q * 90 + 20) * 86_400_000);
        if (reportedAt > now) break;
        const durationHours = 2 + rand() * 2;
        const startedAt = new Date(reportedAt.getTime() + rand() * 8 * 3_600_000);
        const tech = pick(fieldTechs);
        orders.push({
          code: nextCode(),
          assetId: row.id,
          type: "predictivo",
          status: "cerrada",
          priority: 3,
          title: `Análisis de vibraciones — ${row.tag}`,
          description: "Monitoreo de condición trimestral. Sin hallazgos críticos.",
          assignedTo: tech.id,
          reportedAt,
          startedAt,
          finishedAt: new Date(startedAt.getTime() + durationHours * 3_600_000),
          downtimeMinutes: 0,
          estimatedHours: durationHours.toFixed(2),
          laborHours: durationHours.toFixed(2),
          laborCost: (durationHours * tech.hourlyRate).toFixed(2),
          partsCost: "0",
        });
      }
    }
  }

  orders.sort((a, b) => (a.reportedAt as Date).getTime() - (b.reportedAt as Date).getTime());
  // Se reasignan los códigos para que sigan el orden cronológico.
  orders.forEach((o, i) => {
    o.code = `OT-2026-${String(i + 1).padStart(4, "0")}`;
  });

  await db.insert(workOrders).values(orders);

  console.log(`
✔ Seed completo
  ${equipmentRows.length + PLANT.length + 1} activos
  ${techs.length} técnicos
  ${modes.length} modos de falla
  ${orders.length} órdenes de trabajo
`);
}

main()
  .catch((err) => {
    console.error("✖ Error en el seed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
