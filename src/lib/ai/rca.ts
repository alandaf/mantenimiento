import { z } from "zod";
import { db } from "@/db";
import { getActiveOrgId } from "@/lib/org";
import { getFormatters } from "@/lib/config";
import { aiInsights } from "@/db/schema";
import { getFailurePattern, type FailurePattern } from "@/lib/kpi/patterns";
import { AI_MODEL, getClient } from "./client";
import { executeTool, TOOL_DEFINITIONS } from "./tools";

/** Las 6M del diagrama de Ishikawa. */
const ISHIKAWA_BRANCHES = [
  "maquina",
  "metodo",
  "material",
  "mano_de_obra",
  "medicion",
  "medio_ambiente",
] as const;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    problema: {
      type: "string",
      description:
        "El problema en una frase, con la cifra que lo cuantifica (ocurrencias, horas de parada).",
    },
    cinco_porques: {
      type: "array",
      description:
        "Cadena de 5 niveles. Cada nivel pregunta por qué ocurre la respuesta del anterior.",
      items: {
        type: "object",
        properties: {
          nivel: { type: "integer", description: "1 a 5." },
          por_que: { type: "string", description: "La pregunta de este nivel." },
          respuesta: {
            type: "string",
            description: "La causa en este nivel, apoyada en los datos disponibles.",
          },
          evidencia: {
            type: "string",
            description:
              "Dato concreto del historial que respalda la respuesta, o 'hipótesis: falta evidencia' si no lo hay.",
          },
        },
        required: ["nivel", "por_que", "respuesta", "evidencia"],
      },
    },
    ishikawa: {
      type: "object",
      description:
        "Causas posibles agrupadas por las 6M. Cada rama es una lista, vacía si no aplica.",
      properties: Object.fromEntries(
        ISHIKAWA_BRANCHES.map((b) => [
          b,
          { type: "array", items: { type: "string" } },
        ]),
      ),
      required: [...ISHIKAWA_BRANCHES],
    },
    causa_raiz_probable: {
      type: "string",
      description: "La causa raíz más probable, en una o dos frases.",
    },
    confianza: {
      type: "string",
      enum: ["alta", "media", "baja"],
      description:
        "Qué tan respaldada está la conclusión por los datos, no por la plausibilidad del razonamiento.",
    },
    por_que_esa_confianza: {
      type: "string",
      description: "Qué evidencia falta o sobra para justificar ese nivel.",
    },
    acciones: {
      type: "array",
      description: "Acciones concretas para eliminar la causa, no para tratar el síntoma.",
      items: {
        type: "object",
        properties: {
          accion: { type: "string" },
          tipo: {
            type: "string",
            enum: ["correctiva", "preventiva", "predictiva", "rediseno"],
          },
          plazo: { type: "string", enum: ["inmediato", "corto", "medio"] },
          justificacion: { type: "string" },
        },
        required: ["accion", "tipo", "plazo", "justificacion"],
      },
    },
    datos_faltantes: {
      type: "array",
      description:
        "Qué habría que registrar para cerrar el análisis con certeza. Lista vacía si no falta nada.",
      items: { type: "string" },
    },
  },
  required: [
    "problema",
    "cinco_porques",
    "ishikawa",
    "causa_raiz_probable",
    "confianza",
    "por_que_esa_confianza",
    "acciones",
    "datos_faltantes",
  ],
} as const;

const outputSchema = z.object({
  problema: z.string(),
  cinco_porques: z.array(
    z.object({
      nivel: z.number().int(),
      por_que: z.string(),
      respuesta: z.string(),
      evidencia: z.string(),
    }),
  ),
  ishikawa: z.object({
    maquina: z.array(z.string()),
    metodo: z.array(z.string()),
    material: z.array(z.string()),
    mano_de_obra: z.array(z.string()),
    medicion: z.array(z.string()),
    medio_ambiente: z.array(z.string()),
  }),
  causa_raiz_probable: z.string(),
  confianza: z.enum(["alta", "media", "baja"]),
  por_que_esa_confianza: z.string(),
  acciones: z.array(
    z.object({
      accion: z.string(),
      tipo: z.enum(["correctiva", "preventiva", "predictiva", "rediseno"]),
      plazo: z.enum(["inmediato", "corto", "medio"]),
      justificacion: z.string(),
    }),
  ),
  datos_faltantes: z.array(z.string()),
});

export type RootCauseAnalysis = z.infer<typeof outputSchema>;

const buildSystemPrompt = (currencyName: string, currencyExample: string) => `Eres un ingeniero de confiabilidad haciendo un análisis de causa raíz
sobre una falla que se repite en un activo concreto.

Aplicas dos herramientas clásicas:
- 5 Porqués: una cadena de cinco niveles donde cada nivel pregunta por qué ocurre la
  respuesta del anterior, hasta llegar a una causa sobre la que se pueda actuar.
- Ishikawa (6M): causas posibles agrupadas en Máquina, Método, Material, Mano de obra,
  Medición y Medio ambiente.

Reglas que no puedes romper:
- Distingue evidencia de hipótesis, siempre. Si un eslabón de los 5 Porqués no está
  respaldado por el historial, escríbelo igual pero marca su evidencia como
  "hipótesis: falta evidencia". Un análisis honesto con huecos declarados es útil;
  uno que suena seguro sin datos es peligroso.
- Nunca inventes cifras. Los números vienen de las herramientas. Consulta el historial
  del activo y su ficha antes de concluir.
- La confianza la determinan los datos, no lo redondo que suene tu razonamiento. Si
  solo hay dos ocurrencias y ningún dato de condición, la confianza es baja.
- Las acciones deben atacar la causa, no el síntoma. "Cambiar el rodamiento" es tratar
  el síntoma; "corregir la desalineación que destruye el rodamiento" es atacar la causa.
- Los montos están en ${currencyName}: escríbelos con el formato ${currencyExample}.
- Escribe para un ingeniero de mantenimiento: preciso y sin relleno.`;

const MAX_ITERATIONS = 10;

export type RcaRun = {
  pattern: FailurePattern;
  result: RootCauseAnalysis;
  toolCalls: string[];
  model: string;
};

export async function analyzeRootCause(patternKey: string): Promise<RcaRun> {
  const { currencyName, currencyExample } = await getFormatters();
  const SYSTEM_PROMPT = buildSystemPrompt(currencyName, currencyExample);
  const client = getClient();
  const pattern = await getFailurePattern(patternKey);
  if (!pattern) {
    throw new Error(`No existe un patrón de falla con clave ${patternKey}.`);
  }

  const baseRequest = {
    model: AI_MODEL,
    system_instruction: SYSTEM_PROMPT,
    tools: TOOL_DEFINITIONS,
    response_format: {
      type: "text",
      mime_type: "application/json",
      schema: OUTPUT_SCHEMA,
    },
  };

  const toolCalls: string[] = [];

  let interaction = await client.interactions.create({
    ...baseRequest,
    input:
      `Analiza la causa raíz de este patrón de falla repetitiva. Los datos de ` +
      `recurrencia ya están calculados:\n\n` +
      JSON.stringify(pattern, null, 2) +
      `\n\nConsulta el historial completo del activo ${pattern.assetTag} y su ficha ` +
      `antes de concluir. Devuelve el análisis estructurado.`,
  });

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const pending = (interaction.steps ?? []).filter(
      (s) => s.type === "function_call",
    );
    if (pending.length === 0) break;

    const results = [];
    for (const step of pending) {
      toolCalls.push(step.name);
      try {
        const payload = await executeTool(step.name, step.arguments);
        results.push({
          type: "function_result" as const,
          name: step.name,
          call_id: step.id,
          result: JSON.stringify(payload),
        });
      } catch (err) {
        results.push({
          type: "function_result" as const,
          name: step.name,
          call_id: step.id,
          is_error: true,
          result: err instanceof Error ? err.message : String(err),
        });
      }
    }

    interaction = await client.interactions.create({
      ...baseRequest,
      previous_interaction_id: interaction.id,
      input: results,
    });
  }

  const text = interaction.output_text;
  if (!text) {
    throw new Error(
      "El modelo no devolvió el análisis estructurado. Puede haber agotado las iteraciones.",
    );
  }

  const result = outputSchema.parse(JSON.parse(text));

  await db.insert(aiInsights).values({
    organizationId: await getActiveOrgId(),
    scope: "rca",
    refId: pattern.assetId,
    model: AI_MODEL,
    prompt: SYSTEM_PROMPT,
    inputData: { pattern, toolCalls },
    output: result,
  });

  return { pattern, result, toolCalls, model: AI_MODEL };
}
