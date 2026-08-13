import { z } from "zod";
import { CURRENCY_NAME } from "@/lib/config";

/**
 * Contrato del archivo de importación.
 *
 * Las cabeceras se normalizan (minúsculas, sin tildes ni espacios) antes de
 * mapear, así que "Tag Activo", "tag_activo" y "TAG ACTIVO" son la misma
 * columna. Un Excel real nunca viene con las cabeceras que uno espera.
 */
export const COLUMNS = {
  codigo: { label: "Código", required: false, hint: "OT-2026-0001. Si se omite, se genera." },
  tag_activo: { label: "Tag activo", required: true, hint: "Debe existir en el sistema. Ej. EQ-102" },
  tipo: { label: "Tipo", required: true, hint: "correctivo | preventivo | predictivo | mejora" },
  estado: { label: "Estado", required: false, hint: "Por defecto: abierta" },
  prioridad: { label: "Prioridad", required: false, hint: "1 a 4. Por defecto: 3" },
  titulo: { label: "Título", required: true, hint: "Mínimo 5 caracteres" },
  descripcion: { label: "Descripción", required: false, hint: "" },
  modo_falla: { label: "Modo de falla", required: false, hint: "Obligatorio si el tipo es correctivo" },
  responsable: { label: "Responsable", required: false, hint: "Nombre o email del técnico" },
  reportado: { label: "Reportado", required: true, hint: "Fecha u hora de reporte" },
  inicio: { label: "Inicio", required: false, hint: "Inicio de la intervención" },
  fin: { label: "Fin", required: false, hint: "Fin de la intervención" },
  minutos_parada: { label: "Minutos parada", required: false, hint: "Por defecto: 0" },
  horas_estimadas: { label: "Horas estimadas", required: false, hint: "Por defecto: 0" },
  horas_reales: { label: "Horas reales", required: false, hint: "Por defecto: 0" },
  costo_mo: { label: "Costo mano de obra", required: false, hint: `En ${CURRENCY_NAME}` },
  costo_repuestos: { label: "Costo repuestos", required: false, hint: `En ${CURRENCY_NAME}` },
} as const;

export type ColumnKey = keyof typeof COLUMNS;

/**
 * Quita tildes, símbolos y mayúsculas para comparar cabeceras.
 * Los símbolos importan: "N° OT" y "Nº OT" son la misma columna que "n_ot".
 */
export function normalizeHeader(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // marcas diacríticas
    .toLowerCase()
    .replace(/[^a-z0-9\s_.-]/g, "") // °, º, (), :, etc.
    .trim()
    .replace(/[\s.-]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Sinónimos aceptados para cada columna, ya normalizados. */
const ALIASES: Record<ColumnKey, string[]> = {
  codigo: ["codigo", "code", "ot", "numero", "n_ot"],
  tag_activo: ["tag_activo", "tag", "activo", "equipo", "asset", "codigo_activo"],
  tipo: ["tipo", "tipo_ot", "tipo_mantenimiento", "type"],
  estado: ["estado", "status", "situacion"],
  prioridad: ["prioridad", "priority", "prio"],
  titulo: ["titulo", "title", "trabajo", "descripcion_corta", "resumen"],
  descripcion: ["descripcion", "description", "detalle", "observaciones"],
  modo_falla: ["modo_falla", "modo_de_falla", "falla", "failure_mode", "causa"],
  responsable: ["responsable", "tecnico", "asignado", "assigned_to", "ejecutor"],
  reportado: ["reportado", "fecha_reporte", "fecha", "reported_at", "fecha_solicitud"],
  inicio: ["inicio", "fecha_inicio", "started_at", "hora_inicio"],
  fin: ["fin", "fecha_fin", "finished_at", "hora_fin", "termino"],
  minutos_parada: ["minutos_parada", "parada_minutos", "downtime", "downtime_minutes", "tiempo_parada"],
  horas_estimadas: ["horas_estimadas", "estimated_hours", "he"],
  horas_reales: ["horas_reales", "horas_hombre", "labor_hours", "hh"],
  costo_mo: ["costo_mo", "costo_mano_obra", "costo_mano_de_obra", "labor_cost", "mo"],
  costo_repuestos: ["costo_repuestos", "repuestos", "parts_cost", "materiales"],
};

/** Mapea las cabeceras del archivo a las columnas conocidas. */
export function mapHeaders(headers: string[]): {
  mapping: Partial<Record<ColumnKey, number>>;
  unknown: string[];
} {
  const mapping: Partial<Record<ColumnKey, number>> = {};
  const unknown: string[] = [];

  headers.forEach((raw, index) => {
    if (!raw) return;
    const norm = normalizeHeader(raw);
    const key = (Object.keys(ALIASES) as ColumnKey[]).find(
      (k) => ALIASES[k].includes(norm) && mapping[k] === undefined,
    );
    if (key) mapping[key] = index;
    else unknown.push(raw);
  });

  return { mapping, unknown };
}

const TIPOS = ["correctivo", "preventivo", "predictivo", "mejora"] as const;
const ESTADOS = [
  "abierta",
  "asignada",
  "ejecucion",
  "pausada",
  "cerrada",
  "anulada",
] as const;

/** Normaliza variantes comunes que aparecen en archivos reales. */
const TIPO_SYNONYMS: Record<string, (typeof TIPOS)[number]> = {
  correctivo: "correctivo",
  correctiva: "correctivo",
  corrective: "correctivo",
  preventivo: "preventivo",
  preventiva: "preventivo",
  preventive: "preventivo",
  predictivo: "predictivo",
  predictiva: "predictivo",
  mejora: "mejora",
};

const ESTADO_SYNONYMS: Record<string, (typeof ESTADOS)[number]> = {
  abierta: "abierta",
  abierto: "abierta",
  pendiente: "abierta",
  open: "abierta",
  asignada: "asignada",
  asignado: "asignada",
  ejecucion: "ejecucion",
  en_ejecucion: "ejecucion",
  en_proceso: "ejecucion",
  proceso: "ejecucion",
  pausada: "pausada",
  pausado: "pausada",
  detenida: "pausada",
  cerrada: "cerrada",
  cerrado: "cerrada",
  completada: "cerrada",
  finalizada: "cerrada",
  closed: "cerrada",
  anulada: "anulada",
  anulado: "anulada",
  cancelada: "anulada",
};

export function normalizeTipo(value: string): string {
  return TIPO_SYNONYMS[normalizeHeader(value)] ?? value;
}

export function normalizeEstado(value: string): string {
  return ESTADO_SYNONYMS[normalizeHeader(value)] ?? value;
}

/** Fila cruda ya mapeada por columna, antes de validar. */
export type RawRow = Partial<Record<ColumnKey, unknown>> & { _row: number };

export const importRowSchema = z.object({
  codigo: z.string().trim().max(24).optional(),
  tag_activo: z.string().trim().min(1, "El tag del activo es obligatorio"),
  tipo: z
    .string()
    .transform(normalizeTipo)
    .pipe(z.enum(TIPOS, { errorMap: () => ({ message: `Tipo inválido. Use: ${TIPOS.join(", ")}` }) })),
  estado: z
    .string()
    .transform(normalizeEstado)
    .pipe(z.enum(ESTADOS, { errorMap: () => ({ message: `Estado inválido. Use: ${ESTADOS.join(", ")}` }) }))
    .default("abierta"),
  prioridad: z.coerce.number().int().min(1).max(4).default(3),
  titulo: z.string().trim().min(5, "El título necesita al menos 5 caracteres").max(200),
  descripcion: z.string().trim().max(4000).optional(),
  modo_falla: z.string().trim().optional(),
  responsable: z.string().trim().optional(),
  reportado: z.date({ invalid_type_error: "Fecha de reporte inválida" }),
  inicio: z.date().nullable().default(null),
  fin: z.date().nullable().default(null),
  minutos_parada: z.coerce.number().min(0).default(0),
  horas_estimadas: z.coerce.number().min(0).default(0),
  horas_reales: z.coerce.number().min(0).default(0),
  costo_mo: z.coerce.number().min(0).default(0),
  costo_repuestos: z.coerce.number().min(0).default(0),
});

export type ImportRow = z.infer<typeof importRowSchema>;
