"use client";

import { useTransition } from "react";
import { closeWorkOrder } from "@/lib/actions/work-orders";

export function CloseButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void closeWorkOrder(id))}
      className="text-xs text-ink-400 transition hover:text-ok-500 disabled:opacity-40"
      title="Cierra la OT usando la hora actual como fin"
    >
      {pending ? "…" : "Cerrar"}
    </button>
  );
}
