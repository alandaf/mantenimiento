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
  criticality: "critica" | "alta" | "media" | "baja";
  /** Qué es el equipo. Por defecto "otro" si el set no lo declara. */
  assetType?:
    | "sistema"
    | "conjunto"
    | "bomba"
    | "motor"
    | "compresor"
    | "valvula"
    | "instrumento"
    | "controlador"
    | "tablero"
    | "recipiente"
    | "intercambiador"
    | "transportador"
    | "maquina"
    | "vehiculo"
    | "generador"
    | "seguridad"
    | "otro";
  /** Existe un equipo gemelo que asume la carga. */
  hasBackup?: boolean;
  /** Pertenece a un sistema de seguridad: RCI, detección de gas, parada de emergencia. */
  isSafetySystem?: boolean;
  /**
   * Tag de otro equipo del mismo grupo del que este cuelga.
   *
   * Es lo que distingue un componente de un equipo independiente: los cuatro
   * cabezales de llenado no son cuatro máquinas, son partes del carrusel, y
   * una falla en uno tiene que leerse como una falla del carrusel. Sin esto,
   * el Pareto repartiría entre cuatro lo que en realidad es un solo problema.
   */
  parentTag?: string;
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

export type SeedScriptedFailure = {
  assetTag: string;
  /** Meses hacia atrás desde hoy. 8 = hace ocho meses. */
  monthsAgo: number;
  failureCode: string;
  title: string;
  description: string;
  /** Minutos de indisponibilidad. Creciente entre eventos de una misma serie. */
  downtimeMinutes: number;
  repairHours: number;
  /** Repuestos, en la moneda de la instalación. */
  partsCost: number;
  /** Qué se hizo. Se guarda en la descripción del cierre. */
  resolution: string;
  /** Síntoma tal como lo reportó la guardia. */
  symptom?: string;
  /** Causa confirmada en terreno, distinta de la hipótesis. */
  causeFound?: string;
  /**
   * Mediciones tomadas antes y después. Es lo que convierte tres reparaciones
   * sueltas en una serie que se puede graficar y discutir.
   */
  mediciones?: Array<{
    momento: "antes" | "despues";
    variable: string;
    valor: number;
    unidad: string;
    umbral?: number;
  }>;
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
  /**
   * Aplica la curva estacional de invierno a fallas y horómetros.
   * Propio de instalaciones cuya carga depende de la temporada, como una
   * planta de GLP; un buque de línea no la tiene.
   */
  estacional?: boolean;

  /**
   * Fallas escritas a mano, además de las que genera el azar.
   *
   * El generador produce un histórico verosímil pero impredecible, y hay
   * historias que tienen que estar sí o sí: una recurrencia con severidad
   * creciente sobre el mismo equipo es lo que permite demostrar el análisis de
   * causa raíz. Dejarla al azar significa que unas veces aparece y otras no.
   */
  scriptedFailures?: SeedScriptedFailure[];

  /** Prefijo del correlativo de OT. */
  orderPrefix: string;
};
