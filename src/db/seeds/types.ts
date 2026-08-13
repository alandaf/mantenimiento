/**
 * Contrato de un set de datos de demostración.
 *
 * La lógica que genera el historial (fallas, preventivos, costos) es común;
 * lo que cambia entre un set y otro es el catálogo: qué activos hay, cómo
 * fallan y quién los mantiene. Así añadir un mercado nuevo es escribir datos,
 * no lógica.
 */

export type SeedFailureMode = {
  code: string;
  name: string;
  category:
    | "mecanica"
    | "electrica"
    | "instrumentacion"
    | "hidraulica"
    | "neumatica"
    | "operacional"
    | "estructural";
};

export type SeedTechnician = {
  name: string;
  email: string;
  role: "tecnico" | "planificador" | "jefe";
  specialty: string;
  hourlyRate: number;
};

export type SeedEquipment = {
  tag: string;
  name: string;
  criticality: "A" | "B" | "C";
  manufacturer: string;
  model: string;
  /** Costo de una hora de indisponibilidad, en la moneda configurada. */
  downtimeCostPerHour: number;
  /** Fallas esperadas al año — determina el MTBF resultante. */
  failuresPerYear: number;
  /** Horas típicas de reparación [mín, máx]. */
  repairHours: [number, number];
  /** Códigos de modo de falla propios de este equipo, si aplica. */
  likelyFailures?: string[];
  /**
   * Horas de marcha por día. Presente = el activo lleva horómetro.
   * Un motor principal navega ~14 h/día promedio; un generador de emergencia
   * apenas 0.3 h de pruebas semanales; un tanque no acumula horas.
   */
  hoursPerDay?: number;
  /** Horómetro acumulado al inicio del histórico. */
  initialHours?: number;
};

export type SeedGroup = {
  group: { tag: string; name: string };
  equipment: SeedEquipment[];
};

export type SeedPmTemplate = {
  name: string;
  /** Disparador de la rutina. Por horas es lo natural en equipos rotativos. */
  trigger: "calendario" | "horas" | "ambos";
  frequencyDays: number | null;
  frequencyHours: number | null;
  estimatedHours: string;
};

export type SeedDataset = {
  key: string;
  label: string;
  /** Nodo raíz de la jerarquía: la planta, el buque, la instalación. */
  root: { tag: string; name: string; location: string };
  groups: SeedGroup[];
  failureModes: SeedFailureMode[];
  technicians: SeedTechnician[];
  pmTemplates: SeedPmTemplate[];
  /** Prefijo del correlativo de OT. */
  orderPrefix: string;
};
