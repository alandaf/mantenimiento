"use client";

import { useState, useTransition } from "react";
import { approveWorkOrder, rejectWorkOrder } from "@/lib/actions/approvals";
import type { ActionState } from "@/lib/validation";

/**
 * Aprobación o rechazo del trabajo ejecutado.
 *
 * Solo aparece cuando la orden está cerrada: aprobar algo que aún se está
 * haciendo no significa nada. Y cuando el equipo exige segunda firma se dice
 * en pantalla, para que quien ejecutó no descubra la regla al chocar con ella.
 */
export function ApprovalPanel({
  workOrderId,
  estado,
  aprobadoPor,
  aprobadoEl,
  exigeSegundaFirma,
  assetTag,
}: {
  workOrderId: number;
  estado: string;
  aprobadoPor: string | null;
  aprobadoEl: Date | null;
  exigeSegundaFirma: boolean;
  assetTag: string;
}) {
  const [pendiente, startTransition] = useTransition();
  const [estadoAccion, setEstadoAccion] = useState<ActionState | null>(null);
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);

  if (estado !== "cerrada" && !aprobadoPor) {
    return (
      <div className="panel px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Aprobación
        </h2>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
          Disponible al cerrar la orden. Aprobar un trabajo que aún se está
          haciendo no significa nada.
        </p>
      </div>
    );
  }

  if (aprobadoPor) {
    return (
      <div className="panel px-5 py-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Aprobación
        </h2>
        <p className="mt-2 text-sm text-ok-500">✔ Trabajo aprobado</p>
        {aprobadoEl && (
          <p className="mt-0.5 text-[11px] text-ink-400">
            {new Date(aprobadoEl).toLocaleString("es-CL")}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
          La aprobación queda en el historial de cambios y no se puede deshacer
          sin dejar registro.
        </p>
      </div>
    );
  }

  return (
    <div className="panel space-y-3 px-5 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
        Aprobación
      </h2>

      {exigeSegundaFirma && (
        <p className="rounded-md border border-warn-500/30 bg-warn-500/10 px-3 py-2 text-[11px] leading-relaxed text-warn-500">
          {assetTag} es un equipo crítico o de seguridad: debe revisarlo alguien
          distinto de quien ejecutó el trabajo.
        </p>
      )}

      {estadoAccion?.message && (
        <p
          className={`rounded-md px-3 py-2 text-[11px] leading-relaxed ${
            estadoAccion.ok
              ? "bg-ok-500/10 text-ok-500"
              : "bg-bad-500/10 text-bad-500"
          }`}
        >
          {estadoAccion.message}
        </p>
      )}

      {rechazando ? (
        <>
          <textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={3}
            placeholder="Por qué se devuelve el trabajo"
            className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-brand-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pendiente || motivo.trim().length === 0}
              onClick={() =>
                startTransition(async () => {
                  const r = await rejectWorkOrder(workOrderId, motivo);
                  setEstadoAccion(r);
                  if (r.ok) setRechazando(false);
                })
              }
              className="rounded-lg bg-bad-500 px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Confirmar rechazo
            </button>
            <button
              type="button"
              onClick={() => setRechazando(false)}
              className="rounded-lg border border-ink-700 px-3.5 py-2 text-sm text-ink-300 transition hover:bg-ink-800"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pendiente}
            onClick={() =>
              startTransition(async () =>
                setEstadoAccion(await approveWorkOrder(workOrderId)),
              )
            }
            className="rounded-lg bg-brand-500 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {pendiente ? "Guardando…" : "Aprobar trabajo"}
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => setRechazando(true)}
            className="rounded-lg border border-ink-700 px-3.5 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-100 disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      )}
    </div>
  );
}
