"use server";

import { revalidatePath } from "next/cache";
import { MissingApiKeyError } from "@/lib/ai/client";
import { prioritizeWorkOrders } from "@/lib/ai/prioritize";

export type PrioritizeState = {
  ok: boolean;
  message?: string;
};

export async function runPrioritization(): Promise<PrioritizeState> {
  try {
    const run = await prioritizeWorkOrders();
    revalidatePath("/priorizacion");
    return {
      ok: true,
      message: `Priorización generada: ${run.result.ranking.length} órdenes, ${run.toolCalls.length} consultas a la base de datos.`,
    };
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return { ok: false, message: err.message };
    }
    console.error("Fallo en la priorización:", err);
    return { ok: false, message: friendlyMessage(err) };
  }
}

/**
 * La API devuelve JSON crudo en `err.message`. Volcarlo en pantalla no le dice
 * nada al jefe de mantenimiento: se traduce a la acción que corresponde.
 */
function friendlyMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);

  if (raw.includes("credit balance is too low")) {
    return "La cuenta de Anthropic no tiene saldo. Recarga créditos en Plans & Billing y vuelve a intentarlo.";
  }
  if (raw.includes("authentication_error") || raw.includes("invalid x-api-key")) {
    return "La ANTHROPIC_API_KEY es inválida o fue revocada. Revísala en .env.";
  }
  if (raw.includes("rate_limit_error")) {
    return "Se alcanzó el límite de peticiones. Espera un momento y reintenta.";
  }
  if (raw.includes("overloaded_error")) {
    return "El servicio está saturado en este momento. Reintenta en unos segundos.";
  }
  if (raw.includes("not_found_error")) {
    return "El modelo configurado no existe o no está disponible para esta cuenta. Revisa ANTHROPIC_MODEL.";
  }

  // Caso no contemplado: el detalle técnico queda en los logs del servidor.
  return "No se pudo generar la priorización. Revisa los logs del contenedor web.";
}
