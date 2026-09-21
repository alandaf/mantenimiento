"use client";

import { useState, useTransition } from "react";
import { updateTaskResult } from "@/lib/actions/tasks";

/**
 * Un paso de la pauta, ejecutable.
 *
 * El resultado se guarda al pulsar, sin botón de "guardar" al final: un
 * mecánico marca los pasos mientras trabaja, a veces con guantes y a veces sin
 * cobertura, y obligarle a recordar un guardado final es la forma más segura
 * de perder el registro de media rutina.
 */

const TIPOS: Record<string, { texto: string; cls: string }> = {
  verificacion: { texto: "Verificar", cls: "bg-ink-700 text-ink-300" },
  medicion: { texto: "Medir", cls: "bg-brand-500/15 text-brand-300" },
  reemplazo: { texto: "Reemplazar", cls: "bg-warn-500/15 text-warn-500" },
  intervencion: { texto: "Intervenir", cls: "bg-ink-700 text-ink-300" },
  registro: { texto: "Registrar", cls: "bg-ink-700 text-ink-400" },
};

const OPCIONES = [
  { valor: "conforme", texto: "Conforme", activo: "bg-ok-500 text-white", inactivo: "text-ok-500 border-ok-500/40" },
  { valor: "no_conforme", texto: "No conforme", activo: "bg-bad-500 text-white", inactivo: "text-bad-500 border-bad-500/40" },
  { valor: "no_aplica", texto: "No aplica", activo: "bg-ink-600 text-ink-100", inactivo: "text-ink-400 border-ink-700" },
] as const;

export function TaskRow({
  id,
  sequence,
  description,
  kind,
  result,
  value,
  unit,
  notes,
  completedBy,
  editable,
  safetyNote,
}: {
  id: number;
  sequence: number;
  description: string;
  kind: string;
  result: string | null;
  value: string | null;
  unit: string | null;
  notes: string | null;
  completedBy: string | null;
  editable: boolean;
  safetyNote: string | null;
}) {
  const [pendiente, startTransition] = useTransition();
  const [estado, setEstado] = useState(result);
  const [valor, setValor] = useState(value !== null ? String(Number(value)) : "");
  const [nota, setNota] = useState(notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const tipo = TIPOS[kind] ?? TIPOS.verificacion;
  const esMedicion = kind === "medicion";

  function guardar(nuevoEstado: string | null, nuevoValor = valor, nuevaNota = nota) {
    setError(null);
    startTransition(async () => {
      const r = await updateTaskResult(id, nuevoEstado, nuevoValor, nuevaNota);
      if (!r.ok) {
        setError(r.message ?? "No se pudo guardar.");
        setEstado(result);
      } else {
        setEstado(nuevoEstado);
      }
    });
  }

  return (
    <li className={`flex gap-3 px-5 py-3 ${pendiente ? "opacity-60" : ""}`}>
      <span className="num mt-1 w-5 shrink-0 text-[11px] text-ink-600">
        {sequence}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${tipo.cls}`}>
            {tipo.texto}
          </span>
          <span className="text-xs leading-relaxed text-ink-200">{description}</span>
        </div>

        {safetyNote && (
          <p className="mt-1.5 rounded border border-warn-500/30 bg-warn-500/10 px-2 py-1 text-[11px] leading-relaxed text-warn-500">
            ⚠ {safetyNote}
          </p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          {editable ? (
            OPCIONES.map((o) => (
              <button
                key={o.valor}
                type="button"
                disabled={pendiente}
                onClick={() => guardar(estado === o.valor ? null : o.valor)}
                className={`rounded-md border px-2 py-1 text-[11px] font-medium transition disabled:opacity-50 ${
                  estado === o.valor
                    ? `${o.activo} border-transparent`
                    : `${o.inactivo} hover:bg-ink-800`
                }`}
              >
                {o.texto}
              </button>
            ))
          ) : (
            <span
              className={`text-[11px] font-medium ${
                estado === "conforme"
                  ? "text-ok-500"
                  : estado === "no_conforme"
                    ? "text-bad-500"
                    : estado === "no_aplica"
                      ? "text-ink-500"
                      : "text-ink-600"
              }`}
            >
              {estado === "conforme"
                ? "Conforme"
                : estado === "no_conforme"
                  ? "No conforme"
                  : estado === "no_aplica"
                    ? "No aplica"
                    : "Pendiente"}
            </span>
          )}

          {esMedicion &&
            (editable ? (
              <span className="inline-flex items-center gap-1">
                <input
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  onBlur={() => estado && guardar(estado)}
                  inputMode="decimal"
                  placeholder="valor"
                  className="w-24 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 outline-none focus:border-brand-500"
                />
                {unit && <span className="text-[11px] text-ink-400">{unit}</span>}
              </span>
            ) : (
              value !== null && (
                <span className="num text-[11px] text-ink-300">
                  {Number(value)} {unit ?? ""}
                </span>
              )
            ))}

          {completedBy && !editable && (
            <span className="text-[11px] text-ink-500">{completedBy}</span>
          )}
        </div>

        {editable && (
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            onBlur={() => estado && guardar(estado)}
            placeholder="Observación (opcional)"
            className="mt-1.5 w-full rounded-md border border-ink-800 bg-transparent px-2 py-1 text-[11px] text-ink-300 outline-none placeholder:text-ink-600 focus:border-ink-600"
          />
        )}

        {!editable && notes && (
          <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{notes}</p>
        )}

        {error && <p className="mt-1 text-[11px] text-bad-500">{error}</p>}
      </div>
    </li>
  );
}
