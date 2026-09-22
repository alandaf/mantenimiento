"use client";

import { useState, useTransition } from "react";
import { ActionDialog } from "@/components/action-dialog";
import { generatePmWorkOrder } from "@/lib/actions/work-orders";
import type { ActionState } from "@/lib/validation";

const INICIAL: ActionState = { ok: false };

export function GeneratePmButton({ planId, pasos }: { planId: number; pasos: number }) {
  const [pendiente, startTransition] = useTransition();
  const [estado, setEstado] = useState<ActionState>(INICIAL);

  return (
    <>
      <ActionDialog state={estado} />
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          // Si sale bien, la acción redirige a la orden nueva; si no, devuelve
          // el motivo y el aviso lo muestra.
          startTransition(async () => setEstado(await generatePmWorkOrder(planId)))
        }
        title={`Crea la orden de trabajo con los ${pasos} pasos de la pauta`}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
      >
        {pendiente ? "Generando…" : "Generar orden de trabajo"}
      </button>
    </>
  );
}
