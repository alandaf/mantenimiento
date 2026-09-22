"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ActionDialog } from "@/components/action-dialog";
import { addAttachment, retireAttachment } from "@/lib/actions/attachments";
import type { ActionState } from "@/lib/validation";

const INICIAL: ActionState = { ok: false };

const inputCls =
  "w-full rounded-md border border-ink-700 bg-ink-850 px-2.5 py-1.5 text-xs text-ink-100 outline-none focus:border-brand-500";

const CATEGORIAS = [
  ["foto", "Foto"],
  ["informe", "Informe"],
  ["manual", "Manual"],
  ["plano", "Plano"],
  ["ficha_tecnica", "Ficha técnica"],
  ["repuestos", "Lista de repuestos"],
  ["certificado", "Certificado"],
  ["otro", "Otro"],
] as const;

export function AttachmentForm({
  entidad,
  entidadId,
}: {
  entidad: "activo" | "orden_trabajo";
  entidadId: number;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"archivo" | "enlace">("archivo");
  const [estado, accion, guardando] = useActionState(
    addAttachment.bind(null, entidad, entidadId),
    INICIAL,
  );

  useEffect(() => {
    if (estado.ok) ref.current?.reset();
  }, [estado]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full border-t border-ink-800 px-5 py-2.5 text-left text-xs font-medium text-brand-300 transition hover:bg-ink-850"
      >
        + Adjuntar documento o foto
      </button>
    );
  }

  const pestaña = (v: "archivo" | "enlace", texto: string) => (
    <button
      type="button"
      onClick={() => setTipo(v)}
      className={`rounded-md px-2.5 py-1 text-[11px] font-medium ${
        tipo === v ? "bg-brand-500 text-white" : "text-ink-400 hover:bg-ink-800"
      }`}
    >
      {texto}
    </button>
  );

  return (
    <form ref={ref} action={accion} className="space-y-2 border-t border-ink-800 px-5 py-4">
      <ActionDialog state={estado} />
      <div className="flex gap-1">
        {pestaña("archivo", "Subir archivo")}
        {pestaña("enlace", "Enlace del fabricante")}
      </div>
      <input type="hidden" name="kind" value={tipo} />

      {tipo === "archivo" ? (
        <>
          <input
            type="file"
            name="file"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            // En el celular abre directamente la cámara o la galería.
            className="block w-full text-[11px] text-ink-300 file:mr-3 file:rounded-md file:border-0 file:bg-ink-700 file:px-3 file:py-1.5 file:text-xs file:text-ink-100"
          />
          <p className="text-[11px] text-ink-500">PDF, JPG, PNG o WEBP. Máximo 10 MB.</p>
        </>
      ) : (
        <input name="url" type="url" required placeholder="https://… (sitio oficial del fabricante)" className={inputCls} />
      )}

      <div className="grid grid-cols-3 gap-2">
        <select
          name="category"
          defaultValue={tipo === "enlace" ? "manual" : "foto"}
          key={tipo}
          className={inputCls}
        >
          {CATEGORIAS.map(([v, t]) => (
            <option key={v} value={v}>
              {t}
            </option>
          ))}
        </select>
        <input name="title" required placeholder="Título (Sello mecánico al desmontar)" className={`${inputCls} col-span-2`} />
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setAbierto(false)} className="px-2 py-1 text-[11px] text-ink-400 hover:text-ink-100">
          Cerrar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {guardando ? "Subiendo…" : "Adjuntar"}
        </button>
      </div>
      {estado.ok && estado.message && <p className="text-[11px] text-ok-500">{estado.message}</p>}
    </form>
  );
}

export function RetireButton({ id, titulo }: { id: number; titulo: string }) {
  const [pendiente, startTransition] = useTransition();
  const [estado, setEstado] = useState<ActionState>(INICIAL);

  return (
    <>
      <ActionDialog state={estado} />
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          const motivo = prompt(`¿Por qué se retira «${titulo}»? Queda registrado.`);
          if (motivo === null) return;
          startTransition(async () => setEstado(await retireAttachment(id, motivo)));
        }}
        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-ink-500 transition hover:bg-ink-800 hover:text-bad-500 disabled:opacity-40"
        title="Retirar el documento (no se borra: queda en el historial)"
      >
        Retirar
      </button>
    </>
  );
}
