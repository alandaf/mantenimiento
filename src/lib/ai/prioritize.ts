import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { AI_MODEL, getClient } from "./client";
import { executeTool, getOpenWorkOrders, TOOL_DEFINITIONS } from "./tools";

/** Esquema exacto que debe devolver el modelo. */
const OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
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
        additionalProperties: false,
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
            type: ["string", "null"],
            description:
              "Patrón de falla repetitiva detectado en el historial, o null si no hay evidencia de uno.",
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
      patron_detectado: z.string().nullable(),
    }),
  ),
  alertas: z.array(z.string()),
});

export type Prioritization = z.infer<typeof outputSchema>;

const SYSTEM_PROMPT = `Eres el planificador de mantenimiento de una planta de galvanizado.
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
- Escribe para un jefe de mantenimiento con prisa: frases directas, sin relleno.
  La justificación es una o dos frases con cifras, no un párrafo.`;

const MAX_ITERATIONS = 12;

export type PrioritizationRun = {
  result: Prioritization;
  toolCalls: string[];
  usage: { input: number; output: number };
  model: string;
};

/**
 * Ejecuta el bucle agéntico: el modelo consulta las herramientas que necesite y
 * termina devolviendo el ranking en el esquema estructurado.
 */
export async function prioritizeWorkOrders(): Promise<PrioritizationRun> {
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
      usage: { input: 0, output: 0 },
      model: AI_MODEL,
    };
  }

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content:
        `Estas son las ${openOrders.length} órdenes de trabajo abiertas, con su score ` +
        `de riesgo determinista ya calculado:\n\n` +
        JSON.stringify(openOrders, null, 2) +
        `\n\nInvestiga con las herramientas y devuelve el ranking priorizado para hoy.`,
    },
  ];

  const toolCalls: string[] = [];
  let inputTokens = 0;
  let outputTokens = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: {
          type: "json_schema",
          schema: OUTPUT_SCHEMA as unknown as Record<string, unknown>,
        },
      },
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages,
    });

    inputTokens += response.usage.input_tokens;
    outputTokens += response.usage.output_tokens;

    if (response.stop_reason === "refusal") {
      throw new Error("El modelo declinó la solicitud de priorización.");
    }

    if (response.stop_reason === "tool_use") {
      messages.push({ role: "assistant", content: response.content });

      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const block of response.content) {
        if (block.type !== "tool_use") continue;
        toolCalls.push(block.name);
        try {
          const data = await executeTool(
            block.name,
            block.input as Record<string, unknown>,
          );
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(data),
          });
        } catch (err) {
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            is_error: true,
            content: err instanceof Error ? err.message : String(err),
          });
        }
      }

      messages.push({ role: "user", content: results });
      continue;
    }

    // Turno final: la salida estructurada llega como texto que cumple el esquema.
    const text = response.content.find((b) => b.type === "text")?.text;
    if (!text) {
      throw new Error("El modelo no devolvió la priorización estructurada.");
    }

    const result = outputSchema.parse(JSON.parse(text));

    await db.insert(aiInsights).values({
      scope: "priorizacion",
      model: AI_MODEL,
      prompt: SYSTEM_PROMPT,
      inputData: { openOrders, toolCalls },
      output: result,
      tokensIn: inputTokens,
      tokensOut: outputTokens,
    });

    return {
      result,
      toolCalls,
      usage: { input: inputTokens, output: outputTokens },
      model: AI_MODEL,
    };
  }

  throw new Error(
    `La priorización no concluyó en ${MAX_ITERATIONS} iteraciones. Revisa las herramientas.`,
  );
}
