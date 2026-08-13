"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { importWorkOrders, type ImportState } from "@/lib/actions/import";

const INITIAL: ImportState = { ok: false };

function SubmitButton({
  confirm,
  children,
  variant = "primary",
}: {
  confirm: boolean;
  children: React.ReactNode;
  variant?: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();
  const cls =
    variant === "primary"
      ? "bg-brand-500 text-white hover:bg-brand-600"
      : "border border-ink-700 text-ink-300 hover:bg-ink-800 hover:text-ink-100";

  return (
    <button
      type="submit"
      name="confirm"
      value={confirm ? "1" : "0"}
      disabled={pending}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {pending && (
        <span className="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current" />
      )}
      {children}
    </button>
  );
}

export function ImportForm() {
  const [state, formAction] = useActionState(importWorkOrders, INITIAL);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const report = state.report;
  const canImport = Boolean(report && report.validCount > 0 && !state.imported);

  return (
    <form action={formAction} className="space-y-5">
      <div className="panel p-5">
        <label className="block cursor-pointer rounded-lg border-2 border-dashed border-ink-700 px-6 py-8 text-center transition hover:border-brand-500 hover:bg-ink-850">
          <input
            ref={inputRef}
            type="file"
            name="file"
            accept=".xlsx"
            className="sr-only"
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
          />
          {fileName ? (
            <>
              <p className="text-sm font-medium text-ink-100">{fileName}</p>
              <p className="mt-1 text-[11px] text-ink-400">
                Haz clic para elegir otro archivo
              </p>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-300">
                Haz clic para seleccionar tu archivo{" "}
                <span className="font-mono text-brand-300">.xlsx</span>
              </p>
              <p className="mt-1 text-[11px] text-ink-400">Máximo 10 MB</p>
            </>
          )}
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <SubmitButton confirm={false} variant="ghost">
            Validar sin importar
          </SubmitButton>
          {canImport && (
            <SubmitButton confirm>
              Importar {report!.validCount} filas
            </SubmitButton>
          )}
        </div>

        {state.message && (
          <p
            className={`mt-3 text-sm ${
              state.ok ? "text-ok-500" : "text-bad-500"
            }`}
          >
            {state.message}
          </p>
        )}
      </div>

      {report && (
        <div className="panel divide-y divide-ink-800">
          <div className="grid grid-cols-2 gap-px sm:grid-cols-4">
            {[
              { label: "Filas leídas", value: report.totalRows, tone: "" },
              {
                label: "Válidas",
                value: report.validCount,
                tone: report.validCount > 0 ? "text-ok-500" : "",
              },
              {
                label: "Con errores",
                value: new Set(report.issues.map((i) => i.row)).size,
                tone: report.issues.length > 0 ? "text-bad-500" : "",
              },
              {
                label: "Duplicadas",
                value: report.duplicates.length,
                tone: report.duplicates.length > 0 ? "text-warn-500" : "",
              },
            ].map((s) => (
              <div key={s.label} className="px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                  {s.label}
                </p>
                <p className={`num mt-1 text-2xl font-bold ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>

          {report.unknownColumns.length > 0 && (
            <div className="px-5 py-3.5">
              <p className="text-[11px] text-ink-400">
                Columnas ignoradas por no reconocerlas:{" "}
                <span className="text-ink-300">
                  {report.unknownColumns.join(", ")}
                </span>
              </p>
            </div>
          )}

          {report.duplicates.length > 0 && (
            <div className="px-5 py-3.5">
              <p className="text-xs text-warn-500">
                Se omitirán {report.duplicates.length} filas cuyo código ya existe:{" "}
                <span className="font-mono">
                  {report.duplicates.slice(0, 8).join(", ")}
                  {report.duplicates.length > 8 && "…"}
                </span>
              </p>
            </div>
          )}

          {report.issues.length > 0 && (
            <div>
              <div className="px-5 py-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
                  Errores por fila
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-400">
                  El número corresponde a la fila del Excel, para corregirla en el
                  archivo original.
                </p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-ink-800">
                    {report.issues.slice(0, 100).map((issue, i) => (
                      <tr key={i}>
                        <td className="num w-16 px-5 py-2 align-top text-xs text-ink-400">
                          Fila {issue.row}
                        </td>
                        <td className="w-40 px-2 py-2 align-top text-xs text-brand-300">
                          {issue.field}
                        </td>
                        <td className="px-5 py-2 text-xs text-ink-300">
                          {issue.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {report.issues.length > 100 && (
                <p className="px-5 py-2.5 text-[11px] text-ink-400">
                  … y {report.issues.length - 100} errores más.
                </p>
              )}
            </div>
          )}

          {report.sample.length > 0 && !state.imported && (
            <div>
              <h3 className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-ink-300">
                Vista previa de las primeras filas válidas
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                      <th className="px-5 py-2 font-semibold">Código</th>
                      <th className="px-5 py-2 font-semibold">Activo</th>
                      <th className="px-5 py-2 font-semibold">Tipo</th>
                      <th className="px-5 py-2 font-semibold">Título</th>
                      <th className="px-5 py-2 font-semibold">Reportado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-800">
                    {report.sample.map((r) => (
                      <tr key={r.codigo}>
                        <td className="num px-5 py-2 text-xs text-ink-400">
                          {r.codigo}
                        </td>
                        <td className="px-5 py-2 text-xs">{r.tag}</td>
                        <td className="px-5 py-2 text-xs capitalize">{r.tipo}</td>
                        <td className="max-w-xs truncate px-5 py-2 text-xs">
                          {r.titulo}
                        </td>
                        <td className="num px-5 py-2 text-xs text-ink-400">
                          {r.reportado}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
