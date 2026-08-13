import type { SeedDataset } from "./types";

/**
 * Flota marina: sala de máquinas, cubierta y sistemas de casco de un buque
 * portacontenedores. Los montos están en pesos chilenos.
 *
 * Diferencias reales frente a una planta en tierra, que se reflejan en los
 * datos:
 *
 * - **No hay taller externo a la mano.** Una avería en navegación se resuelve
 *   con lo que hay a bordo, así que las reparaciones son más largas.
 * - **La redundancia es la norma.** Tres generadores auxiliares para poder
 *   perder uno; por eso su criticidad individual no es A pese a ser esenciales.
 * - **Los equipos de seguridad no se miden por producción.** El servomotor o el
 *   sistema contraincendios valen por consecuencia de falla, no por costo/hora,
 *   y ahí el "costo de parada" representa riesgo, no lucro cesante.
 * - **La corrosión y el agua salada son modos de falla dominantes**, no
 *   anecdóticos como en tierra.
 */
export const marineDataset: SeedDataset = {
  key: "marino",
  label: "Buque portacontenedores",
  orderPrefix: "OT",
  root: {
    tag: "MN-VALPO",
    name: "M/N Bahía de Valparaíso",
    location: "Buque portacontenedores · 2.800 TEU",
  },

  groups: [
    {
      group: { tag: "SM-100", name: "Sala de Máquinas — Propulsión" },
      equipment: [
        {
          tag: "ME-101",
          name: "Motor principal MAN B&W 6S60MC-C",
          criticality: "A",
          manufacturer: "MAN Energy Solutions",
          model: "6S60MC-C8.2",
          // Un buque parado en fondeo o fuera de itinerario cuesta fletes,
          // penalizaciones de ventana en puerto y combustible sin avance.
          downtimeCostPerHour: 4_200_000,
          failuresPerYear: 7,
          repairHours: [6, 30],
          likelyFailures: ["FM-001", "FM-002", "FM-004", "FM-010"],
        },
        {
          tag: "ME-102",
          name: "Turbocompresor de barrido ABB A175",
          criticality: "A",
          manufacturer: "ABB Turbocharging",
          model: "A175-L",
          downtimeCostPerHour: 3_100_000,
          failuresPerYear: 5,
          repairHours: [5, 20],
          likelyFailures: ["FM-003", "FM-001", "FM-013"],
        },
        {
          tag: "ME-103",
          name: "Eje de cola y bocina",
          criticality: "A",
          manufacturer: "Wärtsilä",
          model: "Sternbeat 700",
          downtimeCostPerHour: 4_500_000,
          failuresPerYear: 2,
          repairHours: [10, 40],
          likelyFailures: ["FM-005", "FM-012"],
        },
        {
          tag: "ME-104",
          name: "Enfriador de agua de camisas",
          criticality: "B",
          manufacturer: "Alfa Laval",
          model: "M15-BFG",
          downtimeCostPerHour: 950_000,
          failuresPerYear: 6,
          repairHours: [3, 12],
          likelyFailures: ["FM-013", "FM-012", "FM-006"],
        },
        {
          tag: "ME-105",
          name: "Bomba de aceite lubricante principal",
          criticality: "A",
          manufacturer: "IMO AB",
          model: "ACG 070",
          downtimeCostPerHour: 2_800_000,
          failuresPerYear: 5,
          repairHours: [3, 10],
          likelyFailures: ["FM-005", "FM-001", "FM-011"],
        },
      ],
    },

    {
      group: { tag: "SM-200", name: "Sala de Máquinas — Generación y Servicios" },
      equipment: [
        {
          tag: "AE-201",
          name: "Motor auxiliar N.º 1 Yanmar 6EY18ALW",
          criticality: "B",
          manufacturer: "Yanmar",
          model: "6EY18ALW",
          // Criticidad B pese a ser esencial: hay tres, la redundancia existe.
          downtimeCostPerHour: 780_000,
          failuresPerYear: 8,
          repairHours: [4, 16],
          likelyFailures: ["FM-001", "FM-004", "FM-010", "FM-014"],
        },
        {
          tag: "AE-202",
          name: "Motor auxiliar N.º 2 Yanmar 6EY18ALW",
          criticality: "B",
          manufacturer: "Yanmar",
          model: "6EY18ALW",
          downtimeCostPerHour: 780_000,
          failuresPerYear: 7,
          repairHours: [4, 16],
          likelyFailures: ["FM-001", "FM-004", "FM-014"],
        },
        {
          tag: "AE-203",
          name: "Motor auxiliar N.º 3 Yanmar 6EY18ALW",
          criticality: "B",
          manufacturer: "Yanmar",
          model: "6EY18ALW",
          downtimeCostPerHour: 780_000,
          failuresPerYear: 9,
          repairHours: [4, 18],
          likelyFailures: ["FM-001", "FM-010", "FM-014"],
        },
        {
          tag: "AE-204",
          name: "Generador de emergencia Caterpillar C18",
          criticality: "A",
          manufacturer: "Caterpillar",
          model: "C18 Marine",
          // Su costo/hora representa riesgo y hallazgo de inspección, no
          // lucro cesante: el buque navega igual, pero fuera de norma.
          downtimeCostPerHour: 1_900_000,
          failuresPerYear: 2,
          repairHours: [4, 14],
          likelyFailures: ["FM-014", "FM-009", "FM-008"],
        },
        {
          tag: "AE-205",
          name: "Caldera de gases de escape",
          criticality: "B",
          manufacturer: "Aalborg",
          model: "AV-6N",
          downtimeCostPerHour: 620_000,
          failuresPerYear: 5,
          repairHours: [5, 20],
          likelyFailures: ["FM-013", "FM-012", "FM-007"],
        },
        {
          tag: "AE-206",
          name: "Purificadora de combustible HFO",
          criticality: "A",
          manufacturer: "Alfa Laval",
          model: "S 946",
          downtimeCostPerHour: 2_400_000,
          failuresPerYear: 10,
          repairHours: [2, 9],
          likelyFailures: ["FM-011", "FM-005", "FM-001", "FM-015"],
        },
        {
          tag: "AE-207",
          name: "Compresor de aire de arranque",
          criticality: "A",
          manufacturer: "Sperre",
          model: "HL2/77",
          downtimeCostPerHour: 2_100_000,
          failuresPerYear: 6,
          repairHours: [3, 11],
          likelyFailures: ["FM-016", "FM-001", "FM-005"],
        },
        {
          tag: "AE-208",
          name: "Separador de sentinas 15 ppm",
          criticality: "B",
          manufacturer: "RWO",
          model: "SKIT/S-DEB",
          // MARPOL Anexo I: una avería aquí es hallazgo de PSC, no solo costo.
          downtimeCostPerHour: 900_000,
          failuresPerYear: 4,
          repairHours: [3, 10],
          likelyFailures: ["FM-011", "FM-015", "FM-009"],
        },
        {
          tag: "AE-209",
          name: "Evaporador de agua dulce",
          criticality: "C",
          manufacturer: "Alfa Laval",
          model: "JWP-26-C80",
          downtimeCostPerHour: 260_000,
          failuresPerYear: 4,
          repairHours: [2, 8],
          likelyFailures: ["FM-013", "FM-012"],
        },
      ],
    },

    {
      group: { tag: "CB-300", name: "Cubierta, Gobierno y Casco" },
      equipment: [
        {
          tag: "DK-301",
          name: "Servomotor (steering gear)",
          criticality: "A",
          manufacturer: "Rolls-Royce Marine",
          model: "SR 662-FCP",
          // SOLAS: sin gobierno el buque no zarpa. El costo refleja detención.
          downtimeCostPerHour: 4_000_000,
          failuresPerYear: 3,
          repairHours: [5, 18],
          likelyFailures: ["FM-010", "FM-011", "FM-008"],
        },
        {
          tag: "DK-302",
          name: "Hélice de proa (bow thruster)",
          criticality: "B",
          manufacturer: "Kongsberg",
          model: "TT2000 AUX",
          downtimeCostPerHour: 1_400_000,
          failuresPerYear: 4,
          repairHours: [4, 16],
          likelyFailures: ["FM-010", "FM-005", "FM-006"],
        },
        {
          tag: "DK-303",
          name: "Molinete de anclas y maquinilla de proa",
          criticality: "B",
          manufacturer: "MacGregor",
          model: "HAW-120",
          downtimeCostPerHour: 850_000,
          failuresPerYear: 5,
          repairHours: [3, 12],
          likelyFailures: ["FM-010", "FM-012", "FM-005"],
        },
        {
          tag: "DK-304",
          name: "Grúa de provisiones de babor",
          criticality: "C",
          manufacturer: "Palfinger Marine",
          model: "PK 15500 M",
          downtimeCostPerHour: 190_000,
          failuresPerYear: 4,
          repairHours: [2, 8],
          likelyFailures: ["FM-010", "FM-012"],
        },
        {
          tag: "DK-305",
          name: "Bomba de lastre N.º 1",
          criticality: "B",
          manufacturer: "Shinko",
          model: "RVP 200-2",
          downtimeCostPerHour: 1_100_000,
          failuresPerYear: 7,
          repairHours: [3, 11],
          likelyFailures: ["FM-005", "FM-012", "FM-001"],
        },
        {
          tag: "DK-306",
          name: "Sistema contraincendios de CO2",
          criticality: "A",
          manufacturer: "Consilium",
          model: "CO2 High Pressure",
          downtimeCostPerHour: 2_600_000,
          failuresPerYear: 2,
          repairHours: [3, 10],
          likelyFailures: ["FM-009", "FM-012", "FM-016"],
        },
        {
          tag: "DK-307",
          name: "Planta de refrigeración de contenedores reefer",
          criticality: "A",
          manufacturer: "Carrier Transicold",
          model: "PrimeLINE",
          // La carga refrigerada se pierde: el costo es la carga, no el equipo.
          downtimeCostPerHour: 3_500_000,
          failuresPerYear: 6,
          repairHours: [3, 14],
          likelyFailures: ["FM-008", "FM-013", "FM-006"],
        },
      ],
    },
  ],

  /**
   * Modos de falla marinos. Los cuatro últimos no tienen equivalente relevante
   * en tierra y son los que más peso tienen a bordo.
   */
  failureModes: [
    { code: "FM-001", name: "Desgaste de camisa, aros o cojinetes", category: "mecanica" },
    { code: "FM-002", name: "Fuga o mala pulverización de inyector", category: "mecanica" },
    { code: "FM-003", name: "Avería de turbocompresor", category: "mecanica" },
    { code: "FM-004", name: "Temperatura alta de gases de escape", category: "operacional" },
    { code: "FM-005", name: "Fuga en sello mecánico o retén", category: "mecanica" },
    { code: "FM-006", name: "Desalineamiento de acople", category: "mecanica" },
    { code: "FM-007", name: "Fuga de vapor en serpentín", category: "mecanica" },
    { code: "FM-008", name: "Falla de variador o arrancador", category: "electrica" },
    { code: "FM-009", name: "Sensor o transmisor sin señal", category: "instrumentacion" },
    { code: "FM-010", name: "Fuga en circuito hidráulico", category: "hidraulica" },
    { code: "FM-011", name: "Obstrucción por lodos o contaminación de combustible", category: "operacional" },
    { code: "FM-012", name: "Corrosión por agua salada", category: "estructural" },
    { code: "FM-013", name: "Incrustación y ensuciamiento de intercambiador", category: "operacional" },
    { code: "FM-014", name: "Entrada de agua salada en aceite lubricante", category: "operacional" },
    { code: "FM-015", name: "Emulsión de agua en combustible", category: "operacional" },
    { code: "FM-016", name: "Fuga en línea de aire comprimido", category: "neumatica" },
  ],

  /** Dotación de máquinas según los roles de un buque mercante. */
  technicians: [
    { name: "Rodrigo Vergara", email: "jefe.maquinas@bahiavalparaiso.cl", role: "jefe", specialty: "Jefe de Máquinas", hourlyRate: 62_000 },
    { name: "Claudia Fuentes", email: "primer.oficial@bahiavalparaiso.cl", role: "planificador", specialty: "Primer Ingeniero", hourlyRate: 48_000 },
    { name: "Matías Soto", email: "segundo.maquinas@bahiavalparaiso.cl", role: "tecnico", specialty: "Segundo Ingeniero", hourlyRate: 38_000 },
    { name: "Ignacio Rojas", email: "tercer.maquinas@bahiavalparaiso.cl", role: "tecnico", specialty: "Tercer Ingeniero", hourlyRate: 32_000 },
    { name: "Pamela Cárcamo", email: "electricista@bahiavalparaiso.cl", role: "tecnico", specialty: "Oficial Electricista", hourlyRate: 36_000 },
    { name: "Héctor Painén", email: "calderero@bahiavalparaiso.cl", role: "tecnico", specialty: "Calderero / Mecánico", hourlyRate: 28_000 },
    { name: "Sebastián Muñoz", email: "engrasador@bahiavalparaiso.cl", role: "tecnico", specialty: "Engrasador", hourlyRate: 22_000 },
    { name: "Valentina Aguirre", email: "cadete@bahiavalparaiso.cl", role: "tecnico", specialty: "Cadete de Máquinas", hourlyRate: 14_000 },
  ],

  /**
   * Rutinas de a bordo. En la práctica el preventivo marino se programa por
   * horas de funcionamiento; aquí se aproxima por calendario porque el modelo
   * de planes es por fecha (ver nota en el README).
   */
  pmTemplates: [
    { name: "Rutina diaria de guardia de máquinas", frequencyDays: 30, estimatedHours: "1.50" },
    { name: "Análisis de aceite lubricante", frequencyDays: 90, estimatedHours: "2.00" },
    { name: "Termografía de tableros principales", frequencyDays: 90, estimatedHours: "3.00" },
    { name: "Inspección de sacrificio anódico y corrosión", frequencyDays: 180, estimatedHours: "6.00" },
    { name: "Overhaul de culatas y camisas", frequencyDays: 365, estimatedHours: "36.00" },
  ],
};
