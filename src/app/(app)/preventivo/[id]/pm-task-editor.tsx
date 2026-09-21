"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ActionDialog } from "@/components/action-dialog";
import { addPmTask, deletePmTask, movePmTask, updatePmTask } from "@/lib/actions/pm-tasks";
import type { ActionState } from "@/lib/validation";

type Paso = {
  id: number;
  sequence: number;
  description: string;
  kind: string;
  expectedUnit: string | null;
  safetyNote: string | null;
};

const INICIAL: ActionState = { ok: false };

const TIPOS: Record<string, { texto: string; cls: string }> = {
  verificacion: { texto: "Verificar", cls: "bg-ink-700 text-ink-300" },
  medicion: { texto: "Medir", cls: "bg-brand-500/15 text-brand-300" },
  reemplazo: { texto: "Reemplazar", cls: "bg-warn-500/15 text-warn-500" },
  intervencion: { texto: "Intervenir", cls: "bg-ink-700 text-ink-300" },
  registro: { texto: "Registrar", cls: "bg-ink-700 text-ink-400" },
};

const inputCls =
  "w-full rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs text-ink-100 outline-none focus:border-brand-500";

export function PmTaskEditor({
  planId,
  pasos,
  editable,
}: {
  planId: number;
  pasos: Paso[];
  editable: boolean;
}) {
  return (
    <div>
      {pasos.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-400">
          Esta rutina aún no tiene pauta. Las órdenes que genere no tendrán pasos que marcar.
        </p>
      ) : (
        <ol className="divide-y divide-ink-800">
          {pasos.map((p, i) => (
            <PasoFila
              key={p.id}
              paso={p}
              editable={editable}
              primero={i === 0}
              ultimo={i === pasos.length - 1}
            />
          ))}
        </ol>
      )}
      {editable && <NuevoPaso planId={planId} />}
    </div>
  );
}

function Campos({ paso }: { paso?: Paso }) {
  const [tipo, setTipo] = useState(paso?.kind ?? "verificacion");
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <select
          name="kind"
          value={tipo}
          onChange={(e) => setTipo(e.target.value)}
          className={`${inputCls} w-36`}
        >
          {Object.entries(TIPOS).map(([v, t]) => (
            <option key={v} value={v}>
              {t.texto}
            </option>
          ))}
        </select>
        {tipo === "medicion" && (
          <input
            name="expectedUnit"
            defaultValue={paso?.expectedUnit ?? ""}
            placeholder="Unidad (mm/s, °C, bar)"
            className={`${inputCls} w-44`}
          />
        )}
      </div>
      <textarea
        name="description"
        defaultValue={paso?.description ?? ""}
        required
        rows={2}
        placeholder="Qué debe hacer el mecánico, en una frase"
        className={inputCls}
      />
      <input
        name="safetyNote"
        defaultValue={paso?.safetyNote ?? ""}
        placeholder="Advertencia de seguridad (opcional): bloqueo, EPP, atmósfera"
        className={inputCls}
      />
    </div>
  );
}

function PasoFila({
  paso,
  editable,
  primero,
  ultimo,
}: {
  paso: Paso;
  editable: boolean;
  primero: boolean;
  ultimo: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [pendiente, startTransition] = useTransition();
  const [resultado, setResultado] = useState<ActionState>(INICIAL);
  const [estado, accion, guardando] = useActionState(
    updatePmTask.bind(null, paso.id),
    INICIAL,
  );

  useEffect(() => {
    if (estado.ok) setEditando(false);
  }, [estado]);

  const tipo = TIPOS[paso.kind] ?? TIPOS.verificacion;
  const botonCls =
    "rounded px-1.5 py-0.5 text-[11px] text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 disabled:opacity-30";

  if (editando) {
    return (
      <li className="bg-ink-850/50 px-5 py-3">
        <ActionDialog state={estado} />
        <form action={accion} className="space-y-2">
          <Campos paso={paso} />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditando(false)} className={botonCls}>
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar paso"}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className={`flex gap-3 px-5 py-3 ${pendiente ? "opacity-50" : ""}`}>
      <ActionDialog state={resultado} />
      <span className="num mt-1 w-5 shrink-0 text-[11px] text-ink-600">{paso.sequence}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tipo.cls}`}>
            {tipo.texto}
          </span>
          <span className="text-xs leading-relaxed text-ink-200">{paso.description}</span>
          {paso.kind === "medicion" && paso.expectedUnit && (
            <span className="text-[11px] text-ink-500">[{paso.expectedUnit}]</span>
          )}
        </div>
        {paso.safetyNote && (
          <p className="mt-1.5 rounded border border-warn-500/30 bg-warn-500/10 px-2 py-1 text-[11px] leading-relaxed text-warn-500">
            ⚠ {paso.safetyNote}
          </p>
        )}
      </div>
      {editable && (
        <div className="flex shrink-0 items-start gap-0.5">
          <button
            type="button"
            title="Subir"
            disabled={primero || pendiente}
            onClick={() =>
              startTransition(async () => setResultado(await movePmTask(paso.id, "arriba")))
            }
            className={botonCls}
          >
            ↑
          </button>
          <button
            type="button"
            title="Bajar"
            disabled={ultimo || pendiente}
            onClick={() =>
              startTransition(async () => setResultado(await movePmTask(paso.id, "abajo")))
            }
            className={botonCls}
          >
            ↓
          </button>
          <button type="button" onClick={() => setEditando(true)} className={botonCls}>
            Editar
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => {
              if (!confirm(`¿Quitar el paso ${paso.sequence} de la pauta? Queda registrado.`)) return;
              startTransition(async () => setResultado(await deletePmTask(paso.id)));
            }}
            className={`${botonCls} hover:text-bad-500`}
          >
            Quitar
          </button>
        </div>
      )}
    </li>
  );
}

function NuevoPaso({ planId }: { planId: number }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [clave, setClave] = useState(0);
  const [estado, accion, guardando] = useActionState(addPmTask.bind(null, planId), INICIAL);

  useEffect(() => {
    if (estado.ok) {
      formRef.current?.reset();
      // Remonta los campos para que el tipo vuelva a "Verificar".
      setClave((k) => k + 1);
    }
  }, [estado]);

  return (
    <form ref={formRef} action={accion} className="space-y-2 border-t border-ink-800 px-5 py-4">
      <ActionDialog state={estado} />
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        Agregar paso al final
      </h3>
      <Campos key={clave} />
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {guardando ? "Agregando…" : "Agregar paso"}
        </button>
      </div>
    </form>
  );
}
