import type { SeedDataset } from "./types";

/** Planta de galvanizado en tierra. Montos en pesos chilenos. */
export const industrialDataset: SeedDataset = {
  key: "industrial",
  label: "Planta de galvanizado",
  orderPrefix: "OT",
  root: {
    tag: "PLT-01",
    name: "Planta Gálvanica Quilicura",
    location: "Quilicura, Santiago",
  },

  groups: [
    {
      group: { tag: "L-100", name: "Línea de Galvanizado 1" },
      equipment: [
        { tag: "EQ-101", name: "Horno de recocido", criticality: "A", manufacturer: "Andritz", model: "HR-4500", downtimeCostPerHour: 2_600_000, failuresPerYear: 6, repairHours: [3, 14] },
        { tag: "EQ-102", name: "Bomba de zinc fundido", criticality: "A", manufacturer: "KSB", model: "Etanorm 125", downtimeCostPerHour: 2_200_000, failuresPerYear: 11, repairHours: [2, 9] },
        { tag: "EQ-103", name: "Desbobinadora", criticality: "B", manufacturer: "Fagor", model: "DB-20", downtimeCostPerHour: 840_000, failuresPerYear: 5, repairHours: [1, 5] },
        { tag: "EQ-104", name: "Compresor de aire principal", criticality: "A", manufacturer: "Atlas Copco", model: "GA-90", downtimeCostPerHour: 1_760_000, failuresPerYear: 8, repairHours: [2, 7] },
        { tag: "EQ-105", name: "Tanque de decapado", criticality: "B", manufacturer: "Fabricación local", model: "TD-3", downtimeCostPerHour: 650_000, failuresPerYear: 3, repairHours: [2, 8] },
        { tag: "EQ-106", name: "Rectificador de corriente", criticality: "A", manufacturer: "Siemens", model: "SINAMICS DCM", downtimeCostPerHour: 1_950_000, failuresPerYear: 4, repairHours: [3, 12] },
      ],
    },
    {
      group: { tag: "L-200", name: "Línea de Galvanizado 2" },
      equipment: [
        { tag: "EQ-201", name: "Horno de secado", criticality: "B", manufacturer: "Andritz", model: "HS-2200", downtimeCostPerHour: 1_400_000, failuresPerYear: 5, repairHours: [2, 10] },
        { tag: "EQ-202", name: "Bomba centrífuga de proceso", criticality: "B", manufacturer: "Grundfos", model: "NK-80", downtimeCostPerHour: 1_020_000, failuresPerYear: 9, repairHours: [1.5, 6] },
        { tag: "EQ-203", name: "Sistema hidráulico de tensores", criticality: "A", manufacturer: "Bosch Rexroth", model: "HPU-45", downtimeCostPerHour: 1_580_000, failuresPerYear: 10, repairHours: [2, 8] },
        { tag: "EQ-204", name: "Faja transportadora de salida", criticality: "C", manufacturer: "Habasit", model: "TC-12", downtimeCostPerHour: 320_000, failuresPerYear: 7, repairHours: [0.5, 3] },
        { tag: "EQ-205", name: "Rebobinadora", criticality: "B", manufacturer: "Fagor", model: "RB-20", downtimeCostPerHour: 880_000, failuresPerYear: 4, repairHours: [1, 5] },
      ],
    },
    {
      group: { tag: "L-300", name: "Servicios Auxiliares" },
      equipment: [
        { tag: "EQ-301", name: "Torre de enfriamiento", criticality: "B", manufacturer: "Evapco", model: "AT-118", downtimeCostPerHour: 740_000, failuresPerYear: 4, repairHours: [2, 9] },
        { tag: "EQ-302", name: "Caldera pirotubular", criticality: "A", manufacturer: "Cleaver-Brooks", model: "CB-200", downtimeCostPerHour: 2_040_000, failuresPerYear: 3, repairHours: [4, 16] },
        { tag: "EQ-303", name: "Grupo electrógeno", criticality: "A", manufacturer: "Caterpillar", model: "C18", downtimeCostPerHour: 2_800_000, failuresPerYear: 2, repairHours: [3, 12] },
        { tag: "EQ-304", name: "Planta de tratamiento de efluentes", criticality: "B", manufacturer: "Veolia", model: "PTE-50", downtimeCostPerHour: 560_000, failuresPerYear: 6, repairHours: [1, 6] },
        { tag: "EQ-305", name: "Puente grúa 10t", criticality: "C", manufacturer: "Demag", model: "EKKE-10", downtimeCostPerHour: 370_000, failuresPerYear: 3, repairHours: [1, 5] },
        { tag: "EQ-306", name: "Chiller de proceso", criticality: "B", manufacturer: "Carrier", model: "30XA-252", downtimeCostPerHour: 930_000, failuresPerYear: 5, repairHours: [2, 7] },
      ],
    },
  ],

  failureModes: [
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
  ],

  technicians: [
    { name: "Carlos Mendoza", email: "cmendoza@galvanica.cl", role: "jefe", specialty: "Gestión", hourlyRate: 42_000 },
    { name: "Ana Quispe", email: "aquispe@galvanica.cl", role: "planificador", specialty: "Planificación", hourlyRate: 35_000 },
    { name: "Luis Ramírez", email: "lramirez@galvanica.cl", role: "tecnico", specialty: "Mecánica", hourlyRate: 26_000 },
    { name: "Jorge Huamán", email: "jhuaman@galvanica.cl", role: "tecnico", specialty: "Electricidad", hourlyRate: 28_000 },
    { name: "María Salazar", email: "msalazar@galvanica.cl", role: "tecnico", specialty: "Instrumentación", hourlyRate: 30_000 },
    { name: "Pedro Ccahuana", email: "pccahuana@galvanica.cl", role: "tecnico", specialty: "Mecánica", hourlyRate: 24_000 },
    { name: "Rosa Ivanov", email: "rivanov@galvanica.cl", role: "tecnico", specialty: "Hidráulica", hourlyRate: 27_000 },
    { name: "Diego Flores", email: "dflores@galvanica.cl", role: "tecnico", specialty: "Electricidad", hourlyRate: 25_000 },
  ],

  pmTemplates: [
    { name: "Inspección visual y lubricación", trigger: "calendario", frequencyDays: 30, frequencyHours: null, estimatedHours: "2.00" },
    { name: "Análisis de vibraciones", trigger: "calendario", frequencyDays: 90, frequencyHours: null, estimatedHours: "3.50" },
    { name: "Termografía de tableros", trigger: "calendario", frequencyDays: 90, frequencyHours: null, estimatedHours: "2.50" },
    { name: "Cambio de aceite y filtros", trigger: "ambos", frequencyDays: 180, frequencyHours: 4_000, estimatedHours: "5.00" },
    { name: "Overhaul mayor", trigger: "calendario", frequencyDays: 365, frequencyHours: null, estimatedHours: "24.00" },
  ],
};
