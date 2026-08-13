import { EmptyState, PageHeader, Panel } from "@/components/ui";
import { listUsers } from "@/lib/actions/users";
import { dateFmt } from "@/lib/config";
import { requireRole, ROLES, type Role } from "@/lib/session";
import { CreateUserForm, UserRowActions } from "./user-admin";

export const dynamic = "force-dynamic";
export const metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const session = await requireRole("admin");
  const users = await listUsers();

  const active = users.filter((u) => !u.banned).length;

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle={`${users.length} cuentas · ${active} activas · solo el administrador de la instalación puede gestionarlas`}
      />

      <div className="grid gap-5 p-6 xl:grid-cols-3">
        <Panel title="Cuentas" className="xl:col-span-2">
          {users.length === 0 ? (
            <EmptyState message="Todavía no hay cuentas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-ink-800 text-left text-[11px] uppercase tracking-wider text-ink-400">
                    <th className="px-5 py-2.5 font-semibold">Persona</th>
                    <th className="px-5 py-2.5 font-semibold">Rol</th>
                    <th className="px-5 py-2.5 font-semibold">Alta</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-800">
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={`transition hover:bg-ink-850 ${
                        u.banned ? "opacity-50" : ""
                      }`}
                    >
                      <td className="px-5 py-3">
                        <span className="font-medium">{u.name}</span>
                        {u.banned && (
                          <span className="ml-2 rounded-full bg-bad-500/15 px-2 py-0.5 text-[10px] font-medium text-bad-500 ring-1 ring-inset ring-bad-500/30">
                            Deshabilitada
                          </span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-ink-400">
                          {u.email}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-brand-300">
                        {ROLES[(u.role ?? "lectura") as Role] ?? u.role}
                      </td>
                      <td className="num px-5 py-3 text-xs text-ink-400">
                        {dateFmt.format(u.createdAt)}
                      </td>
                      <td className="px-5 py-3">
                        <UserRowActions
                          user={u}
                          isSelf={u.id === session.user.id}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Nueva cuenta">
            <CreateUserForm />
          </Panel>

          <Panel title="Qué puede hacer cada rol">
            <dl className="space-y-2.5 px-5 py-4 text-xs leading-relaxed">
              {[
                ["Administrador", "Todo, más la gestión de cuentas."],
                ["Jefe de Máquinas", "Todo el mantenimiento; no gestiona cuentas."],
                ["Planificador", "Además importa datos y planifica rutinas."],
                ["Técnico", "Registra lecturas, ejecuta y cierra órdenes."],
                ["Solo lectura", "Consulta tableros y reportes, sin modificar."],
              ].map(([role, desc]) => (
                <div key={role}>
                  <dt className="font-medium text-ink-100">{role}</dt>
                  <dd className="text-ink-400">{desc}</dd>
                </div>
              ))}
            </dl>
            <div className="border-t border-ink-800 px-5 py-3.5">
              <p className="text-[11px] leading-relaxed text-ink-400">
                Las cuentas se deshabilitan, no se borran: el histórico de órdenes
                queda ligado a quien las ejecutó, y borrarlas rompería la
                trazabilidad de quién hizo qué.
              </p>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
