"use client";

import { useState, useTransition } from "react";
import { ActionDialog } from "@/components/action-dialog";
import { closeWorkOrder } from "@/lib/actions/work-orders";
import type { ActionState } from "@/lib/validation";

const INICIAL: ActionState = { ok: false };

/**
 * Cierre de la orden desde la ficha.
 *
 * Antes había que cambiar el desplegable de estado, rellenar las fechas y
 * pulsar "Guardar cambios". Eso es lo que hace un administrativo corrigiendo un
 * registro, no lo que hace un mecánico que acaba de terminar la rutina: él
 * busca un botón que diga que terminó.
 *
 * El botón usa la hora actual como fin y, si la orden nunca se inició, toma la
 * de reporte como inicio. Pedirle esas dos fechas a alguien que acaba de
 * cerrar la caja de herramientas es pedirle que invente datos.
 */
export function ClosePanel({
  workOrderId,
  pasosPendientes,
  totalPasos,
}: {
  workOrderId: number;
  pasosPendientes: number;
  totalPasos: number;
}) {
  const [pendiente, startTransition] = useTransition();
  const [estado, setEstado] = useState<ActionState>(INICIAL);

  const bloqueado = pasosPendientes > 0;

  return (
    <div className="panel space-y-3 px-5 py-4">
      <ActionDialog state={estado} />

      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
        Cerrar la orden
      </h2>

      {totalPasos > 0 && (
        <p className="text-[11px] leading-relaxed text-ink-400">
          {bloqueado ? (
            <>
              Quedan{" "}
              <span className="font-medium text-warn-500">
                {pasosPendientes} de {totalPasos} pasos
              </span>{" "}
              sin registrar. Cada uno debe quedar como conforme, no conforme o
              no aplica.
            </>
          ) : (
            <>Los {totalPasos} pasos de la pauta están registrados.</>
          )}
        </p>
      )}

      <p className="text-[11px] leading-relaxed text-ink-500">
        Se registra la hora actual como fin de la intervención.
      </p>

      <button
        type="button"
        disabled={pendiente || bloqueado}
        // Deshabilitado y con el motivo a la vista, no habilitado y fallando
        // al pulsar: quien no puede cerrar debe saber por qué antes de
        // intentarlo.
        title={
          bloqueado
            ? "Faltan pasos de la pauta por registrar"
            : "Cierra la orden con la hora actual"
        }
        onClick={() =>
          startTransition(async () => setEstado(await closeWorkOrder(workOrderId)))
        }
        className="w-full rounded-lg bg-ok-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:bg-ink-700 disabled:text-ink-400"
      >
        {pendiente ? "Cerrando…" : "Cerrar orden"}
      </button>
    </div>
  );
}
