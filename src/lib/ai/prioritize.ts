import { z } from "zod";
import { db } from "@/db";
import { getFormatters } from "@/lib/config";
import { aiInsights } from "@/db/schema";
import { AI_MODEL, getClient } from "./client";
import { executeTool, getOpenWorkOrders, TOOL_DEFINITIONS } from "./tools";

/** Esquema exacto que debe devolver el modelo. */
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    resumen: {
      type: "string",
      description:
        "Dos o tres frases para el jefe de mantenimiento: qué exige atención hoy y por qué.",
    },
    ranking: {
      type: "array",
      description: "Órdenes ordenadas de mayor a menor urgencia real.",
      items: {
        type: "object",
        properties: {
          code: { type: "string", description: "Código de la OT, ej. OT-2026-0042." },
          posicion: { type: "integer", description: "Posición en el ranking, desde 1." },
          score_ajustado: {
            type: "number",
            description:
              "Score final 0-100. Parte del score determinista y solo se ajusta si hay evidencia en los datos.",
          },
          justificacion: {
            type: "string",
            description:
              "Por qué va en esa posición, citando cifras concretas obtenidas de las herramientas.",
          },
          accion_recomendada: {
            type: "string",
            description: "La siguiente acción concreta, en una frase.",
          },
          patron_detectado: {
            type: "string",
            description:
              "Patrón de falla repetitiva detectado en el historial. Cadena vacía si no hay evidencia de uno.",
          },
        },
        required: [
          "code",
          "posicion",
          "score_ajustado",
          "justificacion",
          "accion_recomendada",
          "patron_detectado",
        ],
      },
    },
    alertas: {
      type: "array",
      description:
        "Riesgos sistémicos que el ranking por sí solo no muestra. Lista vacía si no hay ninguno.",
      items: { type: "string" },
    },
  },
  required: ["resumen", "ranking", "alertas"],
} as const;

const outputSchema = z.object({
  resumen: z.string(),
  ranking: z.array(
    z.object({
      code: z.string(),
      posicion: z.number().int(),
      score_ajustado: z.number(),
      justificacion: z.string(),
      accion_recomendada: z.string(),
      // Gemini no admite tipos nulables en el esquema: se normaliza aquí.
      patron_detectado: z
        .string()
        .transform((v) => (v.trim() === "" ? null : v))
        .nullable(),
    }),
  ),
  alertas: z.array(z.string()),
});

export type Prioritization = z.infer<typeof outputSchema>;

const buildSystemPrompt = (currencyName: string, currencyExample: string) => `Eres el planificador de mantenimiento de una planta de galvanizado.
Tu tarea es priorizar las órdenes de trabajo abiertas para el turno de hoy.

Cada OT llega con un score de riesgo ya calculado de forma determinista a partir de
cinco factores: criticidad del activo, prioridad declarada, antigüedad de la orden,
fallas repetidas en 90 días y costo de parada por hora.

Ese score es tu punto de partida, no tu conclusión. Tu aporte es el contexto que la
aritmética no ve: fallas que se repiten, activos que concentran el gasto, planes
preventivos vencidos, dependencias entre equipos de una misma línea.

Reglas:
- Nunca inventes una cifra. Todo número que menciones debe venir de una herramienta.
  Si no lo verificaste, no lo afirmes.
- Ajusta el score solo cuando tengas evidencia concreta, y di cuál es. Un ajuste sin
  respaldo es peor que ningún ajuste.
- Usa las herramientas antes de concluir: consulta los KPIs para situar el periodo, el
  Pareto para saber qué modos de falla ya duelen, y el historial de los activos que
  encabezan el ranking para confirmar si hay un patrón.
- Una parada de línea en un activo clase A pesa más que varias incidencias menores.
- Los montos están en ${currencyName}: escríbelos con el formato ${currencyExample}.
- Escribe para un jefe de mantenimiento con prisa: frases directas, sin relleno.
  La justificación es una o dos frases con cifras, no un párrafo.
- Deja patron_detectado como cadena vacía si no encontraste evidencia de un patrón.`;

const MAX_ITERATIONS = 12;

export type PrioritizationRun = {
  result: Prioritization;
  toolCalls: string[];
  model: string;
};

/**
 * Bucle agéntico sobre la API `interactions` de Gemini: el modelo pide las
 * herramientas que necesite y termina devolviendo el ranking estructurado.
 *
 * El estado de la conversación lo mantiene el servidor mediante
 * `previous_interaction_id`, así que no reenviamos el historial en cada vuelta.
 */
export async function prioritizeWorkOrders(): Promise<PrioritizationRun> {
  const { currencyName, currencyExample } = await getFormatters();
  const SYSTEM_PROMPT = buildSystemPrompt(currencyName, currencyExample);
  const client = getClient();
  const openOrders = await getOpenWorkOrders();

  if (openOrders.length === 0) {
    return {
      result: {
        resumen: "No hay órdenes de trabajo abiertas. No se requiere priorización.",
        ranking: [],
        alertas: [],
      },
      toolCalls: [],
      model: AI_MODEL,
    };
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
      `Estas son las ${openOrders.length} órdenes de trabajo abiertas, con su score ` +
      `de riesgo determinista ya calculado:\n\n` +
      JSON.stringify(openOrders, null, 2) +
      `\n\nInvestiga con las herramientas y devuelve el ranking priorizado para hoy.`,
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
        // is_error se lo dice al modelo explícitamente, en vez de disfrazar el
        // fallo como un resultado válido y dejar que razone sobre datos falsos.
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
      "El modelo no devolvió la priorización estructurada. Puede haber agotado las iteraciones.",
    );
  }

  const result = outputSchema.parse(JSON.parse(text));

  await db.insert(aiInsights).values({
    scope: "priorizacion",
    model: AI_MODEL,
    prompt: SYSTEM_PROMPT,
    inputData: { openOrders, toolCalls },
    output: result,
  });

  return { result, toolCalls, model: AI_MODEL };
}
