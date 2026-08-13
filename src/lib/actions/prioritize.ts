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

  if (/API key not valid|API_KEY_INVALID|PERMISSION_DENIED|401|403/.test(raw)) {
    return "La GEMINI_API_KEY es inválida o no tiene permiso para este modelo. Revísala en .env.";
  }
  if (/RESOURCE_EXHAUSTED|quota|429/i.test(raw)) {
    return "Se agotó la cuota de la API de Gemini. Espera unos minutos o revisa tu plan.";
  }
  if (/UNAVAILABLE|503|overloaded/i.test(raw)) {
    return "El servicio de Gemini está saturado en este momento. Reintenta en unos segundos.";
  }
  if (/NOT_FOUND|is not found for API version|404/.test(raw)) {
    return "El modelo configurado no existe o no está disponible para esta cuenta. Revisa GEMINI_MODEL.";
  }
  if (raw.includes("no devolvió la priorización")) {
    return raw;
  }

  // Caso no contemplado: el detalle técnico queda en los logs del servidor.
  return "No se pudo generar la priorización. Revisa los logs del contenedor web.";
}
