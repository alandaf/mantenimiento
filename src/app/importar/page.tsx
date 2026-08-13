import { Button, PageHeader, Panel } from "@/components/ui";
import { COLUMNS, type ColumnKey } from "@/lib/import/schema";
import { ImportForm } from "./import-form";

export const metadata = { title: "Importar órdenes de trabajo · GMAO-AI" };

export default function ImportarPage() {
  const keys = Object.keys(COLUMNS) as ColumnKey[];

  return (
    <>
      <PageHeader
        title="Importar desde Excel"
        subtitle="Carga el histórico de órdenes de trabajo que hoy vive en una hoja de cálculo"
        actions={
          <Button href="/api/plantilla" variant="ghost">
            ↓ Descargar plantilla
          </Button>
        }
      />

      <div className="grid gap-5 p-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ImportForm />
        </div>

        <Panel title="Columnas reconocidas" hint="* obligatorias">
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-sm">
              <tbody className="divide-y divide-ink-800">
                {keys.map((k) => (
                  <tr key={k}>
                    <td className="px-5 py-2 align-top">
                      <span className="text-xs font-medium">
                        {COLUMNS[k].label}
                        {COLUMNS[k].required && (
                          <span className="text-bad-500"> *</span>
                        )}
                      </span>
                      {COLUMNS[k].hint && (
                        <span className="mt-0.5 block text-[11px] text-ink-400">
                          {COLUMNS[k].hint}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-ink-800 px-5 py-3.5">
            <p className="text-[11px] leading-relaxed text-ink-400">
              Las cabeceras se reconocen sin distinguir mayúsculas ni tildes, y se
              aceptan sinónimos habituales (&laquo;Equipo&raquo; por
              &laquo;Tag activo&raquo;, &laquo;N° OT&raquo; por
              &laquo;Código&raquo;). Las columnas que no se reconozcan se ignoran
              sin bloquear la importación.
            </p>
          </div>
        </Panel>
      </div>
    </>
  );
}
