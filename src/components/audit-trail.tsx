import { Panel } from "@/components/ui";
import { getFormatters } from "@/lib/config";
import { historialDe } from "@/lib/audit";

/**
 * Historial de cambios de un registro.
 *
 * Se muestra en la ficha, no escondido en una pantalla de administración: el
 * valor de la auditoría está en que la vea quien está mirando la orden, no en
 * que exista en una tabla que nadie consulta.
 */

const ACCIONES: Record<string, { texto: string; cls: string }> = {
  crear: { texto: "Creada", cls: "text-ok-500" },
  modificar: { texto: "Modificada", cls: "text-ink-300" },
  cambiar_estado: { texto: "Cambio de estado", cls: "text-brand-300" },
  cambiar_prioridad: { texto: "Cambio de prioridad", cls: "text-warn-500" },
  reasignar: { texto: "Reasignada", cls: "text-ink-300" },
  cerrar: { texto: "Cerrada", cls: "text-ok-500" },
  anular: { texto: "Anulada", cls: "text-bad-500" },
  reabrir: { texto: "Reabierta", cls: "text-warn-500" },
  aprobar: { texto: "Aprobada", cls: "text-ok-500" },
  rechazar: { texto: "Rechazada", cls: "text-bad-500" },
};

/** Nombres legibles de los campos, para no mostrar el nombre de la columna. */
const CAMPOS: Record<string, string> = {
  status: "Estado",
  priority: "Prioridad",
  title: "Título",
  description: "Descripción",
  assignedTo: "Responsable",
  assetId: "Activo",
  failureModeId: "Modo de falla",
  type: "Tipo",
  startedAt: "Inicio",
  finishedAt: "Término",
  downtimeMinutes: "Minutos de parada",
  laborHours: "Horas de trabajo",
  laborCost: "Costo de mano de obra",
  partsCost: "Costo de repuestos",
  estimatedHours: "Horas estimadas",
};

function valor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) return v.toISOString().slice(0, 16).replace("T", " ");
  return String(v);
}

export async function AuditTrail({
  entidad,
  entidadId,
}: {
  entidad: "orden_trabajo" | "activo" | "plan_preventivo" | "usuario" | "configuracion" | "lectura_horometro";
  entidadId: string | number;
}) {
  const [eventos, { dateTimeFmt }] = await Promise.all([
    historialDe(entidad, entidadId),
    getFormatters(),
  ]);

  return (
    <Panel title="Historial de cambios" hint={`${eventos.length} registros`}>
      {eventos.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-400">
          Sin cambios registrados. La auditoría guarda lo que ocurra desde ahora.
        </p>
      ) : (
        <ol className="divide-y divide-ink-800">
          {eventos.map((e) => {
            const accion = ACCIONES[e.action] ?? {
              texto: e.action,
              cls: "text-ink-300",
            };
            const cambios = (e.changes ?? {}) as Record<
              string,
              { antes: unknown; despues: unknown }
            >;

            return (
              <li key={e.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className={`text-xs font-semibold ${accion.cls}`}>
                    {accion.texto}
                  </span>
                  <span className="num text-[11px] text-ink-400">
                    {dateTimeFmt.format(e.createdAt)}
                  </span>
                </div>

                <p className="mt-0.5 text-[11px] text-ink-400">
                  {e.actorName}
                  <span className="text-ink-600"> · {e.actorEmail}</span>
                </p>

                {Object.keys(cambios).length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {Object.entries(cambios).map(([campo, v]) => (
                      <li key={campo} className="text-[11px] leading-relaxed">
                        <span className="text-ink-300">
                          {CAMPOS[campo] ?? campo}:
                        </span>{" "}
                        <span className="text-ink-500 line-through">
                          {valor(v.antes)}
                        </span>{" "}
                        <span className="text-ink-600">→</span>{" "}
                        <span className="text-ink-100">{valor(v.despues)}</span>
                      </li>
                    ))}
                  </ul>
                )}

                {e.reason && (
                  <p className="mt-2 rounded-md border border-ink-700 bg-ink-850 px-3 py-2 text-[11px] leading-relaxed text-ink-300">
                    <span className="font-medium text-ink-100">Motivo: </span>
                    {e.reason}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}
