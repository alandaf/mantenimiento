"use client";

import { useActionState } from "react";
import { ActionDialog } from "@/components/action-dialog";
import { updateRoleLabels } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/validation";

const INICIAL: ActionState = { ok: false };

/** Lo que puede cada nivel. Fijo: es lo que el nombre no cambia. */
const PERMISOS: Array<[string, string]> = [
  ["admin", "Cuentas y configuración, más todo lo demás"],
  ["jefe", "Aprueba el trabajo (segunda firma)"],
  ["planificador", "Activos, pautas e importación"],
  ["tecnico", "Ejecuta y cierra órdenes"],
  ["lectura", "Solo consulta"],
];

export function RoleLabelsForm({
  actuales,
  porDefecto,
}: {
  actuales: Record<string, string>;
  porDefecto: Record<string, string>;
}) {
  const [estado, accion, guardando] = useActionState(updateRoleLabels, INICIAL);

  return (
    <form action={accion} className="space-y-3 px-5 py-4">
      <ActionDialog state={estado} />
      <p className="text-[11px] leading-relaxed text-ink-400">
        Cada instalación llama a sus roles como los llama su organización. Solo cambia el
        nombre: lo que puede hacer cada nivel es el mismo en todas partes. Un campo vacío
        vuelve al nombre por defecto.
      </p>
      {PERMISOS.map(([clave, permiso]) => (
        <label key={clave} className="grid gap-1 sm:grid-cols-[1fr_1.2fr] sm:items-center sm:gap-3">
          <span className="text-[11px] text-ink-400">
            <span className="block font-medium text-ink-200">{permiso}</span>
            por defecto: {porDefecto[clave]}
          </span>
          <input
            name={clave}
            defaultValue={actuales[clave]}
            maxLength={40}
            placeholder={porDefecto[clave]}
            className="w-full rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs text-ink-100 outline-none focus:border-brand-500"
          />
        </label>
      ))}
      <div className="flex items-center justify-end gap-3 pt-1">
        {estado.ok && estado.message && <span className="text-[11px] text-ok-500">{estado.message}</span>}
        <button
          type="submit"
          disabled={guardando}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar nombres"}
        </button>
      </div>
    </form>
  );
}
