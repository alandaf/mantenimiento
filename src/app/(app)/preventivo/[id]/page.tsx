import Link from "next/link";
import { and, asc, desc, eq, notInArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { assets, pmPlans, pmTasks, workOrders } from "@/db/schema";
import { AuditTrail } from "@/components/audit-trail";
import { Badge, PageHeader, Panel } from "@/components/ui";
import { getActiveOrgId } from "@/lib/org";
import { hasRole } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { GeneratePmButton } from "./generate-button";
import { PmTaskEditor } from "./pm-task-editor";

export const dynamic = "force-dynamic";

const TRIGGER_LABEL: Record<string, string> = {
  calendario: "Calendario",
  horas: "Horas de marcha",
  ambos: "Lo que llegue primero",
};

export default async function PlanPreventivoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id)) notFound();

  const session = await requireSession();
  const orgId = await getActiveOrgId();

  const [plan] = await db
    .select({
      id: pmPlans.id,
      name: pmPlans.name,
      trigger: pmPlans.trigger,
      frequencyDays: pmPlans.frequencyDays,
      frequencyHours: pmPlans.frequencyHours,
      estimatedHours: pmPlans.estimatedHours,
      assetId: assets.id,
      assetTag: assets.tag,
      assetName: assets.name,
      criticality: assets.criticality,
    })
    .from(pmPlans)
    .innerJoin(assets, eq(assets.id, pmPlans.assetId))
    .where(and(eq(pmPlans.id, id), eq(pmPlans.organizationId, orgId)))
    .limit(1);
  if (!plan) notFound();

  const pasos = await db
    .select({
      id: pmTasks.id,
      sequence: pmTasks.sequence,
      description: pmTasks.description,
      kind: pmTasks.kind,
      expectedUnit: pmTasks.expectedUnit,
      safetyNote: pmTasks.safetyNote,
    })
    .from(pmTasks)
    .where(and(eq(pmTasks.pmPlanId, id), eq(pmTasks.organizationId, orgId)))
    .orderBy(asc(pmTasks.sequence), asc(pmTasks.id));

  // La orden viva de esta rutina, si la hay: se muestra en lugar del botón,
  // para no emitir dos órdenes de la misma mantención.
  const [abierta] = await db
    .select({ id: workOrders.id, code: workOrders.code, status: workOrders.status })
    .from(workOrders)
    .where(
      and(
        eq(workOrders.organizationId, orgId),
        eq(workOrders.pmPlanId, id),
        notInArray(workOrders.status, ["cerrada", "anulada"]),
      ),
    )
    .orderBy(desc(workOrders.reportedAt))
    .limit(1);

  const editable = hasRole(session.user.role, "planificador");
  const cadencia = [
    plan.frequencyHours && `cada ${plan.frequencyHours.toLocaleString()} h`,
    plan.frequencyDays && `cada ${plan.frequencyDays} días`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <PageHeader
        title={plan.name}
        subtitle={`${TRIGGER_LABEL[plan.trigger]} · ${cadencia} · ${Number(plan.estimatedHours)} h estimadas`}
      />

      <div className="space-y-5 p-6">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link href="/preventivo" className="text-ink-400 hover:text-brand-300">
            ← Plan preventivo
          </Link>
          <span className="text-ink-700">|</span>
          <Link
            href={`/ordenes?activo=${plan.assetId}`}
            className="text-ink-300 hover:text-brand-300"
          >
            {plan.assetTag} · {plan.assetName}
          </Link>
          <Badge value={plan.criticality} />
          <div className="ml-auto flex items-center gap-3">
            {abierta ? (
              <Link
                href={`/ordenes/${abierta.id}`}
                className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-200 transition hover:bg-ink-800"
              >
                Orden abierta: {abierta.code} →
              </Link>
            ) : (
              editable && <GeneratePmButton planId={id} pasos={pasos.length} />
            )}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Panel
              title="Pauta de la rutina"
              hint={`${pasos.length} pasos · lo que el mecánico ejecuta en cada orden`}
            >
              <p className="border-b border-ink-800 px-5 py-3 text-[11px] leading-relaxed text-ink-400">
                Los cambios valen para las órdenes que se generen desde ahora. Las
                órdenes ya emitidas conservan la pauta con la que se crearon.
                {!editable && " Solo un planificador, jefe o administrador puede modificarla."}
              </p>
              <PmTaskEditor planId={id} pasos={pasos} editable={editable} />
            </Panel>
          </div>
          <div>
            <AuditTrail entidad="plan_preventivo" entidadId={id} />
          </div>
        </div>
      </div>
    </>
  );
}
