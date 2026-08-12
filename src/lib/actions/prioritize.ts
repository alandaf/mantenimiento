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
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "No se pudo generar la priorización.",
    };
  }
}
