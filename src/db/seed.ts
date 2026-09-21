import { sql } from "drizzle-orm";
import { db, sqlClient } from "./index";
import {
  assets,
  failureModes,
  auditLog,
  measurements,
  meterReadings,
  pmPlans,
  settings,
  technicians,
  pmTasks,
  workOrderMaterials,
  workOrderTasks,
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
import { glpDataset } from "./seeds/glp";
import type { SeedDataset } from "./seeds/types";
import { diagnosticoPara, esRotativo, repuestoPara } from "./seeds/enriquecer";

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
  glp: glpDataset,
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

/**
 * Factor estacional por mes, de enero a diciembre.
 *
 * Una instalación que falla igual los doce meses del año no existe, y con
 * datos planos se nota enseguida que son de relleno. En una planta de GLP en
 * Chile la demanda se dispara en invierno —junio, julio y agosto— y con ella
 * las horas de envasado, el desgaste y las fallas. En un buque el patrón es
 * otro, así que el set declara si lo aplica y con qué intensidad.
 */
const ESTACION_GLP = [
  0.75, 0.7, 0.8, 1.0, 1.3, 1.65, 1.8, 1.6, 1.25, 0.95, 0.8, 0.75,
];

/** Peso estacional de una fecha, o 1 si el set no usa estacionalidad. */
function factorEstacional(fecha: Date, usa: boolean): number {
  return usa ? ESTACION_GLP[fecha.getMonth()] : 1;
}

/**
 * Reparte una fecha en la ventana del histórico siguiendo la estacionalidad.
 *
 * Se sortea una fecha y se acepta con probabilidad proporcional al peso del
 * mes. Es rechazo simple: más lento que una fórmula cerrada, pero da una
 * distribución correcta sin tener que invertir la curva a mano.
 */
function fechaEstacional(
  inicio: Date,
  rangoMs: number,
  usa: boolean,
): Date {
  if (!usa) return new Date(inicio.getTime() + rand() * rangoMs);
  const maximo = Math.max(...ESTACION_GLP);
  for (let intento = 0; intento < 40; intento++) {
    const f = new Date(inicio.getTime() + rand() * rangoMs);
    if (rand() < factorEstacional(f, true) / maximo) return f;
  }
  // Si tras 40 intentos no se aceptó ninguna, se devuelve una cualquiera:
  // mejor una fecha sin sesgo que un bucle que no termina.
  return new Date(inicio.getTime() + rand() * rangoMs);
}

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
      criticality: "critica",
      assetType: "sistema",
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
        criticality: "critica",
        assetType: "sistema",
        location: dataset.root.location,
        status: "operando",
      })
      .returning();

    // Dos pasadas: primero los equipos sin padre dentro del grupo, después los
    // que cuelgan de ellos. Insertar todo junto no sirve porque el hijo
    // necesita el id del padre, que solo existe tras insertarlo.
    const conPadre = group.equipment.filter((e) => e.parentTag);
    const sinPadre = group.equipment.filter((e) => !e.parentTag);

    const construir = (eq: SeedDataset["groups"][number]["equipment"][number],
                       parentId: number): NewAsset => ({
      ...org,
      tag: eq.tag,
      name: eq.name,
      parentId,
      criticality: eq.criticality,
      assetType: eq.assetType ?? "otro",
      hasBackup: eq.hasBackup ?? false,
      isSafetySystem: eq.isSafetySystem ?? false,
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
    });

    const inserted = await db
      .insert(assets)
      .values(sinPadre.map((eq) => construir(eq, node.id)))
      .returning();

    inserted.forEach((row, i) => {
      equipmentRows.push({ row, profile: sinPadre[i] });
    });

    if (conPadre.length > 0) {
      const porTag = new Map(inserted.map((r) => [r.tag, r.id]));
      const hijos = await db
        .insert(assets)
        .values(
          conPadre.map((eq) => {
            const padre = porTag.get(eq.parentTag!);
            if (padre === undefined) {
              throw new Error(
                `El activo ${eq.tag} declara parentTag "${eq.parentTag}", que no existe en el grupo ${group.group.tag}.`,
              );
            }
            return construir(eq, padre);
          }),
        )
        .returning();

      hijos.forEach((row, i) => {
        equipmentRows.push({ row, profile: conPadre[i] });
      });
    }

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
        // El horómetro también sigue la temporada: en invierno la planta
        // envasa más horas por día.
        const temporada = factorEstacional(takenAt, !!dataset.estacional);
        hours += profile.hoursPerDay * 15 * (0.6 + rand() * 0.8) * temporada;
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
        profile.criticality === "critica" ? 3 : profile.criticality === "alta" ? 2 : 1;
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

  // --- Pautas de las rutinas ---
  //
  // Sin pauta, un plan preventivo es solo una fecha de vencimiento. Esto es lo
  // que el mecánico lee en el equipo y lo que después permite saber qué se
  // revisó de verdad, no solo que la orden se cerró.
  console.log("→ Pautas de las rutinas…");
  const tareasPorPlan = new Map<number, Array<{ id: number; sequence: number; description: string; kind: string }>>();
  const tareasPlantilla = insertedPlans.flatMap((plan) => {
    const tpl = dataset.pmTemplates.find((t) => t.name === plan.name);
    return (tpl?.tareas ?? []).map((t, i) => ({
      ...org,
      pmPlanId: plan.id,
      sequence: i + 1,
      description: t.descripcion,
      kind: t.tipo,
      expectedUnit: t.unidad ?? null,
      required: !t.opcional,
      safetyNote: t.seguridad ?? null,
    }));
  });

  if (tareasPlantilla.length > 0) {
    for (let i = 0; i < tareasPlantilla.length; i += 500) {
      const lote = await db
        .insert(pmTasks)
        .values(tareasPlantilla.slice(i, i + 500))
        .returning({
          id: pmTasks.id,
          pmPlanId: pmTasks.pmPlanId,
          sequence: pmTasks.sequence,
          description: pmTasks.description,
          kind: pmTasks.kind,
        });
      for (const t of lote) {
        const lista = tareasPorPlan.get(t.pmPlanId) ?? [];
        lista.push({ id: t.id, sequence: t.sequence, description: t.description, kind: t.kind });
        tareasPorPlan.set(t.pmPlanId, lista);
      }
    }
    console.log(`  ${tareasPlantilla.length} pasos en ${tareasPorPlan.size} rutinas`);
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
      const reportedAt = fechaEstacional(horizonStart, horizonMs, !!dataset.estacional);
      const mode = pick(modePool);
      const priority =
        profile.criticality === "critica"
          ? weighted([[1, 5], [2, 4], [3, 1]] as const)
          : profile.criticality === "alta"
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
        // El diagnóstico se deriva del modo de falla que la orden ya tiene:
        // así el texto es coherente con la falla y no inventado aparte.
        ...(isClosed
          ? diagnosticoPara(mode.category, mode.name, row.name, pick)
          : { symptom: `${mode.name} reportado en ${row.name}.` }),
        unavailableAt: isClosed ? reportedAt : null,
        returnedToServiceAt: isClosed ? finishedAt : null,
      });
    }

    // --- Preventivas ---
    const pmInterval =
      profile.criticality === "critica" ? 30 : profile.criticality === "alta" ? 45 : 90;
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
        // Un preventivo no tiene síntoma que diagnosticar —no hubo falla— pero
        // sí tiene qué se hizo. Dejarlo vacío hace parecer que la rutina no se
        // registró, cuando lo que pasa es que no aplica la otra mitad.
        actionPerformed: complied
          ? pick([
              "Rutina ejecutada completa según pauta. Equipo sin observaciones.",
              "Rutina ejecutada. Se repuso lubricante y se verificó ausencia de fugas.",
              "Rutina ejecutada. Se registraron parámetros de operación dentro de rango.",
              "Rutina ejecutada. Se detectó desgaste incipiente, se deja en seguimiento.",
              "Rutina ejecutada con reemplazo de elementos filtrantes.",
            ])
          : null,
        unavailableAt: complied ? startedAt : null,
        returnedToServiceAt: complied
          ? new Date(startedAt.getTime() + durationHours * 3_600_000)
          : null,
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
    if (profile.criticality === "critica") {
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
          actionPerformed: pick([
            "Análisis de vibraciones ejecutado. Espectro sin componentes anómalas.",
            "Termografía ejecutada. Sin puntos calientes sobre el criterio.",
            "Análisis de aceite enviado a laboratorio. Resultado dentro de límites.",
            "Medición de aislación ejecutada. Valores por sobre el mínimo.",
            "Ultrasonido ejecutado en descansos. Sin indicios de degradación.",
          ]),
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
  // --- Fallas escritas a mano ---
  //
  // Van después de las aleatorias para que el correlativo las ordene junto al
  // resto por fecha: una OT del guion tiene que verse igual que cualquier otra
  // en el listado, no como un añadido al final.
  // Las mediciones se acumulan aquí y se insertan tras las órdenes, porque
  // necesitan el id que la base asigna al guardarlas.
  const medicionesPendientes: Array<{
    codigoOrden: string;
    momento: "antes" | "despues";
    variable: string;
    valor: number;
    unidad: string;
    umbral?: number;
    fecha: Date;
  }> = [];

  for (const g of dataset.scriptedFailures ?? []) {
    const fila = equipmentRows.find((e) => e.row.tag === g.assetTag);
    if (!fila) {
      throw new Error(`El guion referencia el activo ${g.assetTag}, que no existe en el set.`);
    }
    const mode = modeByCode.get(g.failureCode);
    if (!mode) {
      throw new Error(`El guion referencia el modo ${g.failureCode}, que no existe en el set.`);
    }

    const reportedAt = new Date(now.getTime() - g.monthsAgo * 30 * 86_400_000);
    const startedAt = new Date(reportedAt.getTime() + 2 * 3_600_000);
    const finishedAt = new Date(startedAt.getTime() + g.repairHours * 3_600_000);
    const tech = pick(fieldTechs);

    orders.push({
      ...org,
      code: "",
      assetId: fila.row.id,
      type: "correctivo",
      status: "cerrada",
      priority: 1,
      title: g.title,
      description: `${g.description}

Resolución: ${g.resolution}`,
      failureModeId: mode.id,
      assignedTo: tech.id,
      reportedAt,
      startedAt,
      finishedAt,
      downtimeMinutes: g.downtimeMinutes,
      estimatedHours: g.repairHours.toFixed(2),
      laborHours: g.repairHours.toFixed(2),
      laborCost: (g.repairHours * tech.hourlyRate).toFixed(2),
      partsCost: g.partsCost.toFixed(2),
      symptom: g.symptom ?? null,
      causeFound: g.causeFound ?? null,
      actionPerformed: g.resolution,
      unavailableAt: reportedAt,
      returnedToServiceAt: finishedAt,
    });

    for (const m of g.mediciones ?? []) {
      medicionesPendientes.push({
        // Se referencia por título+fecha porque el código aún no existe: se
        // asigna más abajo, al ordenar todas las órdenes por fecha.
        codigoOrden: `${g.assetTag}|${reportedAt.getTime()}`,
        momento: m.momento,
        variable: m.variable,
        valor: m.valor,
        unidad: m.unidad,
        umbral: m.umbral,
        fecha: m.momento === "antes" ? reportedAt : finishedAt,
      });
    }
  }

  orders.sort(
    (a, b) => (a.reportedAt as Date).getTime() - (b.reportedAt as Date).getTime(),
  );
  const year = new Date().getFullYear();
  orders.forEach((o, i) => {
    o.code = `${dataset.orderPrefix}-${year}-${String(i + 1).padStart(4, "0")}`;
  });

  const ordenesGuardadas = await db
    .insert(workOrders)
    .values(orders)
    .returning({
      id: workOrders.id,
      assetId: workOrders.assetId,
      pmPlanId: workOrders.pmPlanId,
      reportedAt: workOrders.reportedAt,
      finishedAt: workOrders.finishedAt,
      status: workOrders.status,
      type: workOrders.type,
      partsCost: workOrders.partsCost,
      failureModeId: workOrders.failureModeId,
      assignedTo: workOrders.assignedTo,
    });

  if (medicionesPendientes.length > 0) {
    // Se reconstruye la clave activo|fecha para emparejar cada medición con la
    // orden que la base acaba de guardar.
    const porClave = new Map<string, number>();
    const tagPorAssetId = new Map(equipmentRows.map((e) => [e.row.id, e.row.tag]));
    for (const o of ordenesGuardadas) {
      const tag = tagPorAssetId.get(o.assetId);
      if (tag) porClave.set(`${tag}|${(o.reportedAt as Date).getTime()}`, o.id);
    }

    const filas = medicionesPendientes.flatMap((m) => {
      const workOrderId = porClave.get(m.codigoOrden);
      if (workOrderId === undefined) return [];
      return [{
        ...org,
        workOrderId,
        moment: m.momento,
        variable: m.variable,
        value: m.valor.toFixed(4),
        unit: m.unidad,
        threshold: m.umbral !== undefined ? m.umbral.toFixed(4) : null,
        takenAt: m.fecha,
      }];
    });

    if (filas.length > 0) await db.insert(measurements).values(filas);
    console.log(`→ ${filas.length} mediciones del guion`);
  }

  // --- Pauta ejecutada en cada rutina ---
  //
  // La pauta se COPIA a la orden, no se referencia. Si mañana se cambia el
  // plan, esta orden debe seguir diciendo lo que realmente se pidió hacer ese
  // día: reescribir el histórico al editar una plantilla seria falsificarlo.
  const tareasEjecutadas: Array<typeof workOrderTasks.$inferInsert> = [];
  for (const o of ordenesGuardadas) {
    if (o.type !== "preventivo" || !o.pmPlanId) continue;
    const pauta = tareasPorPlan.get(o.pmPlanId);
    if (!pauta || pauta.length === 0) continue;

    const cerrada = o.status === "cerrada";
    const fin = (o.finishedAt as Date | null) ?? (o.reportedAt as Date);
    const tecnico = techs.find((t) => t.id === o.assignedTo) ?? techs[0];

    for (const t of pauta) {
      // En una rutina cerrada casi todo sale conforme; algún paso no conforme
      // es lo que hace creíble el registro y lo que origina una correctiva.
      const resultado = !cerrada
        ? null
        : weighted([
            ["conforme", 88],
            ["no_conforme", 8],
            ["no_aplica", 4],
          ] as const);

      tareasEjecutadas.push({
        ...org,
        workOrderId: o.id,
        pmTaskId: t.id,
        sequence: t.sequence,
        description: t.description,
        kind: t.kind as never,
        result: resultado as never,
        value:
          cerrada && t.kind === "medicion" ? (10 + rand() * 80).toFixed(2) : null,
        completedAt: cerrada ? fin : null,
        completedBy: cerrada ? tecnico.name : null,
      });
    }
  }

  if (tareasEjecutadas.length > 0) {
    for (let i = 0; i < tareasEjecutadas.length; i += 500) {
      await db.insert(workOrderTasks).values(tareasEjecutadas.slice(i, i + 500));
    }
    console.log(`  ${tareasEjecutadas.length} pasos ejecutados en rutinas`);
  }

  // --- Relleno del histórico ---
  //
  // Una demostración se explora sin guion: si quien la mira abre una orden
  // cualquiera y encuentra los paneles vacíos, concluye que esas partes no
  // están hechas. Da igual que tres órdenes escogidas se vean perfectas.
  console.log("→ Mediciones, materiales, aprobaciones e historial…");

  const perfilPorAssetId = new Map(
    equipmentRows.map((e) => [e.row.id, { perfil: e.profile, fila: e.row }]),
  );
  const modoPorId = new Map(modes.map((m) => [m.id, m]));
  const jefes = techs.filter((t) => t.role !== "tecnico");

  const medicionesExtra: Array<typeof measurements.$inferInsert> = [];
  const materiales: Array<typeof workOrderMaterials.$inferInsert> = [];
  const auditorias: Array<typeof auditLog.$inferInsert> = [];
  const aprobaciones: Array<{ id: number; userName: string; when: Date }> = [];

  for (const o of ordenesGuardadas) {
    const ctx = perfilPorAssetId.get(o.assetId);
    if (!ctx) continue;
    const cerrada = o.status === "cerrada";
    const fin = (o.finishedAt as Date | null) ?? (o.reportedAt as Date);
    const modo = o.failureModeId ? modoPorId.get(o.failureModeId) : undefined;
    const tecnico = techs.find((t) => t.id === o.assignedTo);

    // Mediciones: solo donde medir vibración y temperatura tiene sentido.
    // Una válvula no vibra, y fingir que sí resta credibilidad.
    if (
      cerrada &&
      o.type === "correctivo" &&
      esRotativo(ctx.fila.assetType) &&
      rand() < 0.65
    ) {
      const vibAntes = 4.8 + rand() * 7;
      const tempAntes = 55 + rand() * 30;
      medicionesExtra.push(
        {
          ...org,
          workOrderId: o.id,
          moment: "antes",
          variable: "Vibración global",
          value: vibAntes.toFixed(2),
          unit: "mm/s",
          threshold: "4.5000",
          takenAt: o.reportedAt as Date,
        },
        {
          ...org,
          workOrderId: o.id,
          moment: "despues",
          variable: "Vibración global",
          value: (1.4 + rand() * 1.8).toFixed(2),
          unit: "mm/s",
          threshold: "4.5000",
          takenAt: fin,
        },
        {
          ...org,
          workOrderId: o.id,
          moment: "antes",
          variable: "Temperatura de descanso",
          value: tempAntes.toFixed(1),
          unit: "°C",
          threshold: "70.0000",
          takenAt: o.reportedAt as Date,
        },
      );
    }

    // Materiales: el detalle de en qué se fue el costo de repuestos.
    const costoRepuestos = Number(o.partsCost ?? 0);
    if (cerrada && costoRepuestos > 0 && modo) {
      const lineas = randInt(1, 3);
      let restante = costoRepuestos;
      for (let i = 0; i < lineas; i++) {
        const ultima = i === lineas - 1;
        const monto = ultima ? restante : restante * (0.3 + rand() * 0.4);
        restante -= monto;
        const cantidad = randInt(1, 4);
        materiales.push({
          ...org,
          workOrderId: o.id,
          description: repuestoPara(modo.category, pick),
          quantity: cantidad.toFixed(3),
          unit: "u",
          unitCost: (monto / cantidad).toFixed(2),
          partNumber: `RP-${randInt(10000, 99999)}`,
        });
      }
    }

    // Aprobación: en equipos críticos o de seguridad, y nunca por el ejecutor.
    const exigeFirma =
      ctx.fila.criticality === "critica" || ctx.fila.isSafetySystem;
    let aprobador: (typeof techs)[number] | undefined;
    if (cerrada && exigeFirma && rand() < 0.72) {
      aprobador = jefes.find((j) => j.id !== o.assignedTo) ?? jefes[0];
      if (aprobador) {
        aprobaciones.push({
          id: o.id,
          userName: aprobador.name,
          when: new Date(fin.getTime() + randInt(2, 48) * 3_600_000),
        });
      }
    }

    // Historial: el ciclo de vida real de la orden, no eventos inventados.
    const actor = tecnico ?? techs[0];
    auditorias.push({
      ...org,
      entity: "orden_trabajo",
      entityId: String(o.id),
      action: "crear",
      actorUserId: null,
      actorName: actor.name,
      actorEmail: actor.email,
      actorRole: actor.role === "jefe" ? "jefe" : "tecnico",
      createdAt: o.reportedAt as Date,
    });
    if (cerrada) {
      auditorias.push({
        ...org,
        entity: "orden_trabajo",
        entityId: String(o.id),
        action: "cerrar",
        actorUserId: null,
        actorName: actor.name,
        actorEmail: actor.email,
        actorRole: "tecnico",
        changes: { status: { antes: "ejecucion", despues: "cerrada" } },
        createdAt: fin,
      });
    }
    if (aprobador) {
      const cuando = aprobaciones[aprobaciones.length - 1].when;
      auditorias.push({
        ...org,
        entity: "orden_trabajo",
        entityId: String(o.id),
        action: "aprobar",
        actorUserId: null,
        actorName: aprobador.name,
        actorEmail: aprobador.email,
        actorRole: "jefe",
        createdAt: cuando,
      });
    }
  }

  const porLotes = async <T>(filas: T[], insertar: (lote: T[]) => Promise<unknown>) => {
    for (let i = 0; i < filas.length; i += 500) {
      await insertar(filas.slice(i, i + 500));
    }
  };

  if (medicionesExtra.length > 0)
    await porLotes(medicionesExtra, (l) => db.insert(measurements).values(l));
  if (materiales.length > 0)
    await porLotes(materiales, (l) => db.insert(workOrderMaterials).values(l));
  if (auditorias.length > 0)
    await porLotes(auditorias, (l) => db.insert(auditLog).values(l));

  for (const a of aprobaciones) {
    await db.execute(sql`
      UPDATE work_orders SET approved_by = ${a.userName}, approved_at = ${a.when.toISOString()}::timestamptz
      WHERE id = ${a.id}
    `);
  }

  console.log(
    `  ${medicionesExtra.length} mediciones · ${materiales.length} materiales · ` +
      `${aprobaciones.length} aprobaciones · ${auditorias.length} eventos de historial`,
  );

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
