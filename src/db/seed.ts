import { sql } from "drizzle-orm";
import { db, sqlClient } from "./index";
import {
  assets,
  failureModes,
  meterReadings,
  pmPlans,
  settings,
  technicians,
  workOrders,
  type NewAsset,
  type NewMeterReading,
  type NewWorkOrder,
} from "./schema";
import { industrialDataset } from "./seeds/industrial";
import { marineDataset } from "./seeds/marine";
import { marineDataset2 } from "./seeds/marine2";
import { mineraDataset } from "./seeds/minera";
import { remolcadorDataset } from "./seeds/remolcador";
import type { SeedDataset } from "./seeds/types";

/**
 * Generador de datos de demostración. La lógica es común a todos los sets: lo
 * que cambia es el catálogo de activos, modos de falla y dotación.
 *
 *   pnpm db:seed              → industrial (por defecto)
 *   pnpm db:seed marino       → flota marina
 *   SEED_DATASET=marino pnpm db:seed
 */
export const DATASETS: Record<string, SeedDataset> = {
  industrial: industrialDataset,
  marino: marineDataset,
  granelero: marineDataset2,
  minera: mineraDataset,
  remolcador: remolcadorDataset,
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

/**
 * Ventanas de lo que puede seguir pendiente hoy.
 *
 * Sin ellas el backlog se llenaba de trabajo de hace meses: una demo que a
 * primera vista parece realista, pero que al abrir una orden muestra un cambio
 * de aceite abierto desde hace 320 días.
 */
const OPEN_CORRECTIVE_WINDOW_DAYS = 45;
const OPEN_PM_WINDOW_DAYS = 60;

export async function seed(dataset: SeedDataset, orgId: string, orgName: string) {
  const org = { organizationId: orgId };
  console.log(`\n→ Set de datos: ${dataset.label} (${dataset.key})`);

  console.log("→ Modos de falla…");
  const modes = await db
    .insert(failureModes)
    .values(dataset.failureModes.map((m) => ({ ...m, ...org })))
    .returning();
  const modeByCode = new Map(
    dataset.failureModes.map((m, i) => [m.code, modes[i]]),
  );

  console.log("→ Dotación…");
  const techs = await db
    .insert(technicians)
    .values(dataset.technicians.map((t) => ({ ...t, ...org })))
    .returning();
  const fieldTechs = techs.filter((t) => t.role === "tecnico");

  console.log("→ Activos…");
  const [root] = await db
    .insert(assets)
    .values({
      ...org,
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
        ...org,
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
          ...org,
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
          tracksHours: eq.hoursPerDay !== undefined,
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

  const now = new Date();
  const horizonStart = new Date(now.getTime() - MONTHS_OF_HISTORY * 30 * 86_400_000);

  console.log("→ Lecturas de horómetro…");
  /** Horómetro actual de cada activo, para cuadrar los planes por horas. */
  const currentHours = new Map<number, number>();
  const readings: NewMeterReading[] = [];

  for (const { row, profile } of equipmentRows) {
    if (profile.hoursPerDay === undefined) continue;

    let hours = profile.initialHours ?? 0;
    // Una lectura cada ~15 días, como una ronda de guardia real.
    for (let day = 0; day <= MONTHS_OF_HISTORY * 30; day += 15) {
      const takenAt = new Date(horizonStart.getTime() + day * 86_400_000);
      if (takenAt > now) break;
      if (day > 0) {
        // El uso varía: travesía, puerto, dique. ±40% sobre el promedio.
        hours += profile.hoursPerDay * 15 * (0.6 + rand() * 0.8);
      }
      readings.push({
        ...org,
        assetId: row.id,
        hours: hours.toFixed(1),
        takenAt,
        source: "manual",
      });
    }
    currentHours.set(row.id, hours);
  }
  if (readings.length > 0) {
    for (let i = 0; i < readings.length; i += 500) {
      await db.insert(meterReadings).values(readings.slice(i, i + 500));
    }
  }

  console.log("→ Planes preventivos…");
  const insertedPlans = await db.insert(pmPlans).values(
    equipmentRows.flatMap(({ row, profile }) => {
      const count =
        profile.criticality === "A" ? 3 : profile.criticality === "B" ? 2 : 1;
      const hours = currentHours.get(row.id) ?? null;

      return dataset.pmTemplates
        .slice(0, count)
        // Una rutina por horas sobre un activo sin horómetro no tiene sentido.
        .filter((tpl) => tpl.trigger === "calendario" || hours !== null)
        .map((tpl) => {
          const usesCalendar = tpl.trigger !== "horas" && tpl.frequencyDays;
          const usesHours = tpl.trigger !== "calendario" && tpl.frequencyHours;

          // Se reparte el ciclo para que algunas rutinas queden vencidas y
          // otras por vencer: un tablero con todo en verde no enseña nada.
          const progress = rand();

          const lastHours = usesHours
            ? hours! - tpl.frequencyHours! * progress
            : null;

          return {
            ...org,
            assetId: row.id,
            name: tpl.name,
            trigger: tpl.trigger,
            frequencyDays: tpl.frequencyDays,
            frequencyHours: tpl.frequencyHours,
            estimatedHours: tpl.estimatedHours,
            lastExecutedAt: new Date(now.getTime() - randInt(5, 60) * 86_400_000),
            lastExecutedHours: lastHours !== null ? lastHours.toFixed(1) : null,
            nextDueAt: usesCalendar
              ? new Date(
                  now.getTime() +
                    randInt(-tpl.frequencyDays!, tpl.frequencyDays!) * 86_400_000,
                )
              : null,
            nextDueHours:
              lastHours !== null
                ? (lastHours + tpl.frequencyHours!).toFixed(1)
                : null,
            active: true,
          };
        });
    }),
  ).returning();

  /** Planes por activo, para vincular cada preventiva a la rutina que la originó. */
  const plansByAsset = new Map<number, typeof insertedPlans>();
  for (const plan of insertedPlans) {
    const list = plansByAsset.get(plan.assetId) ?? [];
    list.push(plan);
    plansByAsset.set(plan.assetId, list);
  }

  console.log("→ Órdenes de trabajo (12 meses)…");
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

      // Una correctiva de hace ocho meses no sigue abierta: a esas alturas o se
      // cerró o se anuló. Solo las recientes siguen vivas, y con probabilidad
      // decreciente — cuanto más vieja, más raro es que nadie la haya tocado.
      //
      // La regla anterior cerraba todo lo terminado hacía más de un día, así que
      // en la práctica no quedaba ninguna correctiva abierta y la pantalla de
      // priorización mostraba solo preventivos rezagados.
      const daysSinceReport =
        (now.getTime() - reportedAt.getTime()) / 86_400_000;
      const stillOpenChance =
        daysSinceReport > OPEN_CORRECTIVE_WINDOW_DAYS
          ? 0
          : 0.8 * (1 - daysSinceReport / OPEN_CORRECTIVE_WINDOW_DAYS);

      // Y no puede darse por cerrada una reparación que aún no termina: una OT
      // cerrada con fecha de término en el futuro corrompería el MTTR.
      const terminaEnElFuturo = finishedAt.getTime() > now.getTime();
      const isClosed = !terminaEnElFuturo && !(rand() < stillOpenChance);

      const openStatus = weighted([
        ["ejecucion", 3],
        ["asignada", 2],
        ["abierta", 2],
        ["pausada", 1],
      ] as const);

      const tech = pick(fieldTechs);
      const laborHours = repairHours * (0.8 + rand() * 0.9);
      const downtimeMinutes = Math.round(
        (responseHours + repairHours * (1 + rand() * 0.4)) * 60,
      );

      orders.push({
        ...org,
        code: "",
        assetId: row.id,
        type: "correctivo",
        status: isClosed ? "cerrada" : openStatus,
        priority,
        title: `${mode.name} en ${row.name}`,
        description: `Reportado por la guardia. Modo de falla identificado: ${mode.name.toLowerCase()}.`,
        failureModeId: mode.id,
        assignedTo: tech.id,
        reportedAt,
        // La fecha de inicio sigue al estado en vez de sortearse: una OT "en
        // ejecución" sin fecha de inicio, o una "abierta" con ella, es una
        // contradicción que el usuario ve en la ficha.
        startedAt: isClosed
          ? startedAt
          : openStatus === "ejecucion" || openStatus === "pausada"
            ? startedAt
            : null,
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

      // Un preventivo sin ejecutar de hace ocho meses no sigue "pendiente": en
      // la práctica se anula al pasar su ventana, porque la rutina siguiente ya
      // lo reemplazó. Antes cualquier incumplimiento podía quedar abierto con
      // cualquier antigüedad, y el backlog acumulaba cambios de aceite de 300
      // días — realista en apariencia, pero absurdo al mirarlo de cerca.
      const daysSincePm = (now.getTime() - reportedAt.getTime()) / 86_400_000;
      const pmStatus = complied
        ? ("cerrada" as const)
        : daysSincePm <= OPEN_PM_WINDOW_DAYS
          ? weighted([["abierta", 3], ["asignada", 1]] as const)
          : ("anulada" as const);
      const assetPlans = plansByAsset.get(row.id) ?? [];
      const originPlan = assetPlans.length > 0 ? pick(assetPlans) : null;
      const durationHours = 1.5 + rand() * 4;
      const startedAt = new Date(reportedAt.getTime() + rand() * 12 * 3_600_000);
      const tech = pick(fieldTechs);

      orders.push({
        ...org,
        code: "",
        assetId: row.id,
        type: "preventivo",
        status: pmStatus,
        priority: 3,
        title: `${originPlan ? originPlan.name : pick(dataset.pmTemplates).name} — ${row.tag}`,
        description: "Ejecución de rutina del plan de mantenimiento preventivo.",
        pmPlanId: originPlan?.id ?? null,
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
          ...org,
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

/**
 * Crea las organizaciones y siembra cada una.
 *
 * Dos buques por defecto: es la única forma de comprobar que el aislamiento
 * funciona. Con una sola instalación, un filtro mal puesto pasa desapercibido
 * porque siempre devuelve todo.
 */
const FLEET: Array<{ slug: string; name: string; dataset: SeedDataset }> = [
  { slug: "bahia-valparaiso", name: "M/N Bahía de Valparaíso", dataset: marineDataset },
  { slug: "estrecho-magallanes", name: "M/N Estrecho de Magallanes", dataset: marineDataset2 },
];

async function main() {
  const requested = (process.argv[2] ?? process.env.SEED_DATASET ?? "flota")
    .trim()
    .toLowerCase();

  // Se limpian los datos de mantenimiento, nunca las cuentas ni las
  // organizaciones: resembrar la demo no puede dejar sin buque a la gente que
  // ya tiene cuenta. Borrar `organization` arrastraba `member` en cascada y las
  // sesiones existentes quedaban huérfanas.
  console.log("→ Limpiando datos de mantenimiento…");
  await db.execute(sql`
    TRUNCATE TABLE work_orders, pm_plans, meter_readings, ai_insights,
                   assets, failure_modes, technicians, settings
    RESTART IDENTITY CASCADE
  `);

  const targets =
    requested === "industrial"
      ? [{ slug: "planta-quilicura", name: "Planta Gálvanica Quilicura", dataset: industrialDataset }]
      : FLEET;

  for (const t of targets) {
    // El slug es la identidad estable de la instalación. Si ya existe se
    // conserva su id: es lo que mantiene válidas las membresías, y con ellas
    // las cuentas de la tripulación.
    const [org] = (await db.execute(sql`
      INSERT INTO organization (id, name, slug, created_at)
      VALUES (${crypto.randomUUID()}, ${t.name}, ${t.slug}, now())
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `)) as unknown as Array<{ id: string }>;

    await db.insert(settings).values({
      organizationId: org.id,
      installationName: t.name,
      currency: "CLP",
      locale: "es-CL",
    });

    await seed(t.dataset, org.id, t.name);
  }

  console.log(
    `
✔ ${targets.length} instalación(es) creada(s). Crea las cuentas con:
` +
      `  pnpm tsx scripts/create-admin.ts "Nombre" correo@dominio.cl "clave-larga" <slug>
`,
  );
}

// Solo cuando se ejecuta este archivo directamente. Otros scripts importan
// `seed` y `DATASETS` para sembrar UNA instalación; si `main()` corriera al
// importar, ese import silencioso vaciaría las tablas de todas las demás.
const ejecutadoDirectamente = process.argv[1]?.replace(/\\/g, "/").endsWith("src/db/seed.ts");

if (ejecutadoDirectamente) {
  main()
    .catch((err) => {
      console.error("✖ Error en el seed:", err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sqlClient.end();
    });
}
