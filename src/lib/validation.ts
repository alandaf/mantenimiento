import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable();

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(v)))
  .nullable()
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Fecha inválida");

export const assetSchema = z.object({
  tag: z
    .string()
    .trim()
    .min(2, "El tag es obligatorio")
    .max(32)
    .regex(/^[A-Za-z0-9-]+$/, "Solo letras, números y guiones"),
  name: z.string().trim().min(3, "El nombre es obligatorio").max(160),
  parentId: z.coerce.number().int().positive().nullable().catch(null),
  criticality: z.enum(["A", "B", "C"]),
  status: z.enum(["operando", "standby", "detenido", "baja"]),
  location: optionalText(120),
  manufacturer: optionalText(120),
  model: optionalText(120),
  serialNumber: optionalText(120),
  downtimeCostPerHour: z.coerce.number().int().min(0).default(0),
  notes: optionalText(2000),
  installedAt: optionalDate,
});

export type AssetInput = z.infer<typeof assetSchema>;

export const workOrderSchema = z
  .object({
    assetId: z.coerce.number().int().positive("Selecciona un activo"),
    type: z.enum(["correctivo", "preventivo", "predictivo", "mejora"]),
    status: z.enum([
      "abierta",
      "asignada",
      "ejecucion",
      "pausada",
      "cerrada",
      "anulada",
    ]),
    priority: z.coerce.number().int().min(1).max(4),
    title: z.string().trim().min(5, "Describe el trabajo").max(200),
    description: optionalText(4000),
    failureModeId: z.coerce.number().int().positive().nullable().catch(null),
    assignedTo: z.coerce.number().int().positive().nullable().catch(null),
    reportedAt: z
      .string()
      .trim()
      .min(1, "La fecha de reporte es obligatoria")
      .transform((v) => new Date(v)),
    startedAt: optionalDate,
    finishedAt: optionalDate,
    downtimeMinutes: z.coerce.number().int().min(0).default(0),
    estimatedHours: z.coerce.number().min(0).default(0),
    laborHours: z.coerce.number().min(0).default(0),
    laborCost: z.coerce.number().min(0).default(0),
    partsCost: z.coerce.number().min(0).default(0),
  })
  // La integridad de las marcas de tiempo no es cosmética: un MTTR negativo
  // contamina todo el dashboard, así que se bloquea en la entrada.
  .refine((d) => !d.startedAt || d.startedAt >= d.reportedAt, {
    message: "El inicio no puede ser anterior al reporte",
    path: ["startedAt"],
  })
  .refine((d) => !d.finishedAt || !!d.startedAt, {
    message: "No se puede cerrar una OT que nunca inició",
    path: ["startedAt"],
  })
  .refine((d) => !d.finishedAt || !d.startedAt || d.finishedAt >= d.startedAt, {
    message: "El fin no puede ser anterior al inicio",
    path: ["finishedAt"],
  })
  .refine((d) => d.status !== "cerrada" || !!d.finishedAt, {
    message: "Una OT cerrada necesita fecha de fin",
    path: ["finishedAt"],
  })
  .refine((d) => d.type !== "correctivo" || d.status === "anulada" || !!d.failureModeId, {
    message: "Toda correctiva necesita un modo de falla para el análisis",
    path: ["failureModeId"],
  });

export type WorkOrderInput = z.infer<typeof workOrderSchema>;

/** Resultado uniforme de las server actions, consumible con useActionState. */
export type ActionState = {
  ok: boolean;
  message?: string;
  errors?: Record<string, string[]>;
};

/** Convierte los issues de Zod al formato de ActionState. */
export function toActionState(error: z.ZodError): ActionState {
  return {
    ok: false,
    message: "Revisa los campos marcados.",
    errors: error.flatten().fieldErrors as Record<string, string[]>,
  };
}
