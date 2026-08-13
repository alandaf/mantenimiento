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
import { industrialDataset } from "./seeds/industrial";
import { marineDataset } from "./seeds/marine";
import type { SeedDataset } from "./seeds/types";

/**
 * Generador de datos de demostración. La lógica es común a todos los sets: lo
 * que cambia es el catálogo de activos, modos de falla y dotación.
 *
 *   pnpm db:seed              → industrial (por defecto)
 *   pnpm db:seed marino       → flota marina
 *   SEED_DATASET=marino pnpm db:seed
 */
const DATASETS: Record<string, SeedDataset> = {
  industrial: industrialDataset,
  marino: marineDataset,
};

/** LCG determinista: el mismo seed produce siempre los mismos KPIs. */
let seedState = 20260817;
function rand(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick<T>(items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}
function weighted<T>(entries: ReadonlyArray<readonly [T, number]>): T {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rand() * total;
  for (const [value, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return entries[entries.length - 1][0];
}

const MONTHS_OF_HISTORY = 12;

async function seed(dataset: SeedDataset) {
  console.log(`\n→ Set de datos: ${dataset.label} (${dataset.key})`);

  console.log("→ Limpiando tablas…");
  await db.execute(sql`
    TRUNCATE TABLE work_orders, pm_plans, ai_insights, assets, failure_modes, technicians
    RESTART IDENTITY CASCADE
  `);

  console.log("→ Modos de falla…");
  const modes = await db
    .insert(failureModes)
    .values(dataset.failureModes.map((m) => ({ ...m })))
    .returning();
  const modeByCode = new Map(
    dataset.failureModes.map((m, i) => [m.code, modes[i]]),
  );

  console.log("→ Dotación…");
  const techs = await db
    .insert(technicians)
    .values(dataset.technicians.map((t) => ({ ...t })))
    .returning();
  const fieldTechs = techs.filter((t) => t.role === "tecnico");

  console.log("→ Activos…");
  const [root] = await db
    .insert(assets)
    .values({
      tag: dataset.root.tag,
      name: dataset.root.name,
      criticality: "A",
      location: dataset.root.location,
      status: "operando",
    })
    .returning();

  const equipmentRows: Array<{
    row: typeof assets.$inferSelect;
    profile: SeedDataset["groups"][number]["equipment"][number];
  }> = [];

  for (const group of dataset.groups) {
    const [node] = await db
      .insert(assets)
      .values({
        tag: group.group.tag,
        name: group.group.name,
        parentId: root.id,
        criticality: "A",
        location: dataset.root.location,
        status: "operando",
      })
      .returning();

    const inserted = await db
      .insert(assets)
      .values(
        group.equipment.map<NewAsset>((eq) => ({
          tag: eq.tag,
          name: eq.name,
          parentId: node.id,
          criticality: eq.criticality,
          status: "operando",
          location: group.group.name,
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
      const count =
        profile.criticality === "A" ? 3 : profile.criticality === "B" ? 2 : 1;
      return dataset.pmTemplates.slice(0, count).map((tpl) => ({
        assetId: row.id,
        name: tpl.name,
        frequencyDays: tpl.frequencyDays,
        estimatedHours: tpl.estimatedHours,
        lastExecutedAt: new Date(now.getTime() - randInt(5, 60) * 86_400_000),
        nextDueAt: new Date(
          now.getTime() +
            randInt(-tpl.frequencyDays, tpl.frequencyDays) * 86_400_000,
        ),
        active: true,
      }));
    }),
  );

  console.log("→ Órdenes de trabajo (12 meses)…");
  const horizonStart = new Date(now.getTime() - MONTHS_OF_HISTORY * 30 * 86_400_000);
  const horizonMs = now.getTime() - horizonStart.getTime();
  const orders: NewWorkOrder[] = [];

  for (const { row, profile } of equipmentRows) {
    // Cada equipo falla con los modos que le corresponden: una purificadora no
    // sufre fisuras estructurales, y mezclarlo arruinaría el Pareto.
    const ownModes = profile.likelyFailures
      ?.map((c) => modeByCode.get(c))
      .filter((m): m is (typeof modes)[number] => Boolean(m));
    const modePool = ownModes && ownModes.length > 0 ? ownModes : modes;

    // --- Correctivas ---
    const failures = Math.max(
      1,
      Math.round(profile.failuresPerYear * (0.75 + rand() * 0.5)),
    );
    for (let i = 0; i < failures; i++) {
      const reportedAt = new Date(horizonStart.getTime() + rand() * horizonMs);
      const mode = pick(modePool);
      const priority =
        profile.criticality === "A"
          ? weighted([[1, 5], [2, 4], [3, 1]] as const)
          : profile.criticality === "B"
            ? weighted([[2, 4], [3, 5], [4, 1]] as const)
            : weighted([[3, 5], [4, 4]] as const);

      const responseHours =
        priority === 1 ? rand() * 2 : priority === 2 ? rand() * 6 : rand() * 30;
      const [minRepair, maxRepair] = profile.repairHours;
      const repairHours = minRepair + rand() * (maxRepair - minRepair);

      const startedAt = new Date(reportedAt.getTime() + responseHours * 3_600_000);
      const finishedAt = new Date(startedAt.getTime() + repairHours * 3_600_000);
      const isClosed =
        finishedAt.getTime() < now.getTime() - 86_400_000 || rand() > 0.25;

      const tech = pick(fieldTechs);
      const laborHours = repairHours * (0.8 + rand() * 0.9);
      const downtimeMinutes = Math.round(
        (responseHours + repairHours * (1 + rand() * 0.4)) * 60,
      );

      orders.push({
        code: "",
        assetId: row.id,
        type: "correctivo",
        status: isClosed
          ? "cerrada"
          : weighted([
              ["ejecucion", 3],
              ["asignada", 2],
              ["abierta", 2],
              ["pausada", 1],
            ] as const),
        priority,
        title: `${mode.name} en ${row.name}`,
        description: `Reportado por la guardia. Modo de falla identificado: ${mode.name.toLowerCase()}.`,
        failureModeId: mode.id,
        assignedTo: tech.id,
        reportedAt,
        startedAt: isClosed ? startedAt : rand() > 0.4 ? startedAt : null,
        finishedAt: isClosed ? finishedAt : null,
        downtimeMinutes: isClosed ? downtimeMinutes : 0,
        estimatedHours: repairHours.toFixed(2),
        laborHours: isClosed ? laborHours.toFixed(2) : "0",
        laborCost: isClosed ? (laborHours * tech.hourlyRate).toFixed(2) : "0",
        partsCost: isClosed
          ? (rand() * profile.downtimeCostPerHour * 0.35).toFixed(2)
          : "0",
      });
    }

    // --- Preventivas ---
    const pmInterval =
      profile.criticality === "A" ? 30 : profile.criticality === "B" ? 45 : 90;
    for (let day = 10; day < MONTHS_OF_HISTORY * 30; day += pmInterval) {
      const reportedAt = new Date(horizonStart.getTime() + day * 86_400_000);
      if (reportedAt > now) break;
      const complied = rand() < 0.85;
      const durationHours = 1.5 + rand() * 4;
      const startedAt = new Date(reportedAt.getTime() + rand() * 12 * 3_600_000);
      const tech = pick(fieldTechs);

      orders.push({
        code: "",
        assetId: row.id,
        type: "preventivo",
        status: complied
          ? "cerrada"
          : weighted([["anulada", 2], ["abierta", 1]] as const),
        priority: 3,
        title: `${pick(dataset.pmTemplates).name} — ${row.tag}`,
        description: "Ejecución de rutina del plan de mantenimiento preventivo.",
        assignedTo: tech.id,
        reportedAt,
        startedAt: complied ? startedAt : null,
        finishedAt: complied
          ? new Date(startedAt.getTime() + durationHours * 3_600_000)
          : null,
        downtimeMinutes: 0,
        estimatedHours: durationHours.toFixed(2),
        laborHours: complied ? durationHours.toFixed(2) : "0",
        laborCost: complied ? (durationHours * tech.hourlyRate).toFixed(2) : "0",
        partsCost: complied ? (rand() * 220_000).toFixed(2) : "0",
      });
    }

    // --- Predictivas en equipos críticos ---
    if (profile.criticality === "A") {
      for (let q = 0; q < 4; q++) {
        const reportedAt = new Date(
          horizonStart.getTime() + (q * 90 + 20) * 86_400_000,
        );
        if (reportedAt > now) break;
        const durationHours = 2 + rand() * 2;
        const startedAt = new Date(reportedAt.getTime() + rand() * 8 * 3_600_000);
        const tech = pick(fieldTechs);
        orders.push({
          code: "",
          assetId: row.id,
          type: "predictivo",
          status: "cerrada",
          priority: 3,
          title: `Monitoreo de condición — ${row.tag}`,
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

  // Los correlativos se asignan al final, en orden cronológico.
  orders.sort(
    (a, b) => (a.reportedAt as Date).getTime() - (b.reportedAt as Date).getTime(),
  );
  const year = new Date().getFullYear();
  orders.forEach((o, i) => {
    o.code = `${dataset.orderPrefix}-${year}-${String(i + 1).padStart(4, "0")}`;
  });

  await db.insert(workOrders).values(orders);

  console.log(`
✔ Seed completo — ${dataset.label}
  ${equipmentRows.length + dataset.groups.length + 1} activos
  ${techs.length} personas
  ${modes.length} modos de falla
  ${orders.length} órdenes de trabajo
`);
}

const requested = (process.argv[2] ?? process.env.SEED_DATASET ?? "industrial")
  .trim()
  .toLowerCase();
const dataset = DATASETS[requested];

if (!dataset) {
  console.error(
    `Set de datos desconocido: "${requested}". Disponibles: ${Object.keys(DATASETS).join(", ")}`,
  );
  process.exit(1);
}

seed(dataset)
  .catch((err) => {
    console.error("✖ Error en el seed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlClient.end();
  });
