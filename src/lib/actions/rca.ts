"use server";

import { revalidatePath } from "next/cache";
import { MissingApiKeyError } from "@/lib/ai/client";
import { analyzeRootCause } from "@/lib/ai/rca";

export type RcaState = {
  ok: boolean;
  message?: string;
};

export async function runRootCauseAnalysis(
  patternKey: string,
): Promise<RcaState> {
  try {
    const run = await analyzeRootCause(patternKey);
    revalidatePath("/causa-raiz");
    return {
      ok: true,
      message: `Análisis completo: confianza ${run.result.confianza}, ${run.result.acciones.length} acciones propuestas.`,
    };
  } catch (err) {
    if (err instanceof MissingApiKeyError) {
      return { ok: false, message: err.message };
    }
    console.error("Fallo en el análisis de causa raíz:", err);
    return { ok: false, message: friendlyMessage(err) };
  }
}

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
  if (raw.includes("No existe un patrón") || raw.includes("no devolvió")) {
    return raw;
  }
  return "No se pudo completar el análisis. Revisa los logs del contenedor web.";
}
