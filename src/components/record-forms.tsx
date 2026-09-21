"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ActionDialog } from "@/components/action-dialog";
import { addMaterial, addMeasurement } from "@/lib/actions/records";
import type { ActionState } from "@/lib/validation";

/**
 * Formularios para agregar mediciones y materiales a una orden abierta.
 *
 * Plegados por defecto: la ficha ya es larga, y la mayoría de las veces se
 * abre para mirar, no para anotar.
 */

const INICIAL: ActionState = { ok: false };

const inputCls =
  "w-full rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs text-ink-100 outline-none focus:border-brand-500";

function useAlGuardar(estado: ActionState, alGuardar: () => void) {
  useEffect(() => {
    if (estado.ok) alGuardar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado]);
}

function Plegable({
  titulo,
  abierto,
  setAbierto,
  children,
}: {
  titulo: string;
  abierto: boolean;
  setAbierto: (v: boolean) => void;
  children: React.ReactNode;
}) {
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full border-t border-ink-800 px-5 py-2.5 text-left text-xs font-medium text-brand-300 transition hover:bg-ink-850"
      >
        + {titulo}
      </button>
    );
  }
  return <div className="space-y-2 border-t border-ink-800 px-5 py-4">{children}</div>;
}

export function MeasurementForm({ workOrderId }: { workOrderId: number }) {
  const ref = useRef<HTMLFormElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, guardando] = useActionState(
    addMeasurement.bind(null, workOrderId),
    INICIAL,
  );
  useAlGuardar(estado, () => ref.current?.reset());

  return (
    <Plegable titulo="Registrar medición" abierto={abierto} setAbierto={setAbierto}>
      <ActionDialog state={estado} />
      <form ref={ref} action={accion} className="space-y-2">
        <input name="variable" required placeholder="Variable (Vibración LA, Temperatura rodamiento)" className={inputCls} />
        <div className="grid grid-cols-3 gap-2">
          <select name="moment" className={inputCls} defaultValue="antes">
            <option value="antes">Antes</option>
            <option value="despues">Después</option>
          </select>
          <input name="value" required inputMode="decimal" placeholder="Valor" className={inputCls} />
          <input name="unit" required placeholder="Unidad" className={inputCls} />
        </div>
        <input name="threshold" inputMode="decimal" placeholder="Límite de alarma (opcional)" className={inputCls} />
        <input name="notes" placeholder="Instrumento u observación (opcional)" className={inputCls} />
        <Botones guardando={guardando} texto="Registrar" onCancelar={() => setAbierto(false)} />
        {estado.ok && estado.message && <p className="text-[11px] text-ok-500">{estado.message}</p>}
      </form>
    </Plegable>
  );
}

export function MaterialForm({
  workOrderId,
  currencySymbol,
}: {
  workOrderId: number;
  currencySymbol: string;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, guardando] = useActionState(
    addMaterial.bind(null, workOrderId),
    INICIAL,
  );
  useAlGuardar(estado, () => ref.current?.reset());

  return (
    <Plegable titulo="Agregar material o repuesto" abierto={abierto} setAbierto={setAbierto}>
      <ActionDialog state={estado} />
      <form ref={ref} action={accion} className="space-y-2">
        <input name="description" required placeholder="Descripción (Rodamiento 6309-2Z)" className={inputCls} />
        <div className="grid grid-cols-3 gap-2">
          <input name="quantity" required inputMode="decimal" defaultValue="1" placeholder="Cantidad" className={inputCls} />
          <input name="unit" placeholder="Unidad (u, l, kg)" className={inputCls} />
          <input name="unitCost" inputMode="decimal" placeholder={`Costo unit. ${currencySymbol}`} className={inputCls} />
        </div>
        <input name="partNumber" placeholder="N° de parte del fabricante (opcional)" className={inputCls} />
        <p className="text-[11px] text-ink-500">El subtotal se suma al costo de repuestos de la orden.</p>
        <Botones guardando={guardando} texto="Agregar" onCancelar={() => setAbierto(false)} />
        {estado.ok && estado.message && <p className="text-[11px] text-ok-500">{estado.message}</p>}
      </form>
    </Plegable>
  );
}

function Botones({
  guardando,
  texto,
  onCancelar,
}: {
  guardando: boolean;
  texto: string;
  onCancelar: () => void;
}) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancelar} className="px-2 py-1 text-[11px] text-ink-400 hover:text-ink-100">
        Cerrar
      </button>
      <button
        type="submit"
        disabled={guardando}
        className="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {guardando ? "Guardando…" : texto}
      </button>
    </div>
  );
}
