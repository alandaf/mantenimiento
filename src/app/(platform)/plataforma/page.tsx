import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { listInstallations } from "@/lib/actions/platform";
import { CreateAdminForm, CreateInstallationForm } from "./platform-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Plataforma" };

const dateFmt = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
});

export default async function PlataformaPage() {
  const installations = await listInstallations();
  const sinAdmin = installations.filter((i) => i.admins === 0);

  return (
    <>
      <PageHeader
        title="Instalaciones"
        subtitle={
          installations.length === 0
            ? "Todavía no hay ninguna instalación dada de alta."
            : `${installations.length} instalaciones · ${sinAdmin.length} sin administrador`
        }
      />

      <div className="grid gap-5 p-6 xl:grid-cols-3">
        <Panel title="Flota" className="xl:col-span-2">
          {installations.length === 0 ? (
            <EmptyState message="Crea la primera instalación con el formulario de la derecha." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-semibold">Instalación</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Cuentas</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Activos</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Órdenes</th>
                    <th className="px-5 py-2.5 font-semibold">Alta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {installations.map((i) => (
                    <tr key={i.id} className="transition hover:bg-ink-850">
                      <td className="px-5 py-3">
                        <span className="font-medium">{i.name}</span>
                        {i.admins === 0 && (
                          <span className="ml-2 rounded-full bg-warn-500/15 px-2 py-0.5 text-[10px] font-medium text-warn-500 ring-1 ring-inset ring-warn-500/30">
                            Sin administrador
                          </span>
                        )}
                        <span className="mt-0.5 block font-mono text-[11px] text-ink-400">
                          {i.slug}
                        </span>
                      </td>
                      <td className="num px-5 py-3 text-right text-xs text-ink-300">
                        {i.members}
                      </td>
                      <td className="num px-5 py-3 text-right text-xs text-ink-300">
                        {i.assets}
                      </td>
                      <td className="num px-5 py-3 text-right text-xs text-ink-300">
                        {i.workOrders}
                      </td>
                      <td className="num px-5 py-3 text-xs text-ink-400">
                        {dateFmt.format(i.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Nueva instalación">
            <CreateInstallationForm />
          </Panel>

          <Panel title="Administrador de instalación">
            <CreateAdminForm
              installations={installations.map((i) => ({
                id: i.id,
                name: i.name,
                admins: i.admins,
              }))}
            />
          </Panel>

          <Panel title="Cómo funciona el alta">
            <div className="space-y-2.5 px-5 py-4 text-xs leading-relaxed text-ink-400">
              <p>
                <span className="font-medium text-ink-100">1.</span> Se crea la
                instalación con su moneda y formato regional. Nace vacía: sin
                activos ni órdenes.
              </p>
              <p>
                <span className="font-medium text-ink-100">2.</span> Se le asigna
                un administrador. A partir de ahí él crea el resto de las cuentas
                de su tripulación, y tú dejas de intervenir.
              </p>
              <p className="border-t border-ink-800 pt-2.5">
                Una instalación sin administrador no la puede usar nadie: no hay
                registro público, así que esa primera cuenta solo puede nacer
                desde aquí.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
