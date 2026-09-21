"use client";

import { useState, useTransition } from "react";
import { ActionDialog } from "@/components/action-dialog";
import { closeWorkOrder } from "@/lib/actions/work-orders";
import type { ActionState } from "@/lib/validation";

const INICIAL: ActionState = { ok: false };

export function CloseButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  // El resultado se recoge, no se descarta. Antes era
  // `void closeWorkOrder(id)`: cuando la pauta estaba incompleta la acción
  // devolvía el motivo y el botón lo tiraba, así que la orden no se cerraba y
  // el usuario no veía nada. Un fallo silencioso es peor que uno ruidoso.
  const [estado, setEstado] = useState<ActionState>(INICIAL);

  return (
    <>
      <ActionDialog state={estado} />
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => setEstado(await closeWorkOrder(id)))
        }
        className="text-xs text-ink-400 transition hover:text-ok-500 disabled:opacity-40"
        title="Cierra la OT usando la hora actual como fin"
      >
        {pending ? "…" : "Cerrar"}
      </button>
    </>
  );
}
