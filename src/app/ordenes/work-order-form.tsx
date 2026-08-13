"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  Field,
  FormMessage,
  Input,
  Select,
  SubmitButton,
  Textarea,
  toLocalInput,
} from "@/components/form";
import { CURRENCY_SYMBOL } from "@/lib/config";
import type { WorkOrder } from "@/db/schema";
import type { ActionState } from "@/lib/validation";

const INITIAL: ActionState = { ok: false };

const TYPES = [
  { value: "correctivo", label: "Correctivo" },
  { value: "preventivo", label: "Preventivo" },
  { value: "predictivo", label: "Predictivo" },
  { value: "mejora", label: "Mejora" },
];

const STATUSES = [
  { value: "abierta", label: "Abierta" },
  { value: "asignada", label: "Asignada" },
  { value: "ejecucion", label: "En ejecución" },
  { value: "pausada", label: "Pausada" },
  { value: "cerrada", label: "Cerrada" },
  { value: "anulada", label: "Anulada" },
];

const PRIORITIES = [
  { value: 1, label: "1 — Urgente (parada de línea)" },
  { value: 2, label: "2 — Alta" },
  { value: 3, label: "3 — Media" },
  { value: 4, label: "4 — Baja" },
];

export function WorkOrderForm({
  action,
  workOrder,
  assets,
  technicians,
  failureModes,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  workOrder?: WorkOrder;
  assets: Array<{ id: number; tag: string; name: string }>;
  technicians: Array<{ id: number; name: string; specialty: string | null }>;
  failureModes: Array<{ id: number; name: string; category: string }>;
}) {
  const [state, formAction] = useActionState(action, INITIAL);
  // El modo de falla solo aplica a correctivas; se controla en cliente para
  // que el formulario refleje la misma regla que valida el servidor.
  const [type, setType] = useState(workOrder?.type ?? "correctivo");
  const isCorrective = type === "correctivo";

  return (
    <form action={formAction} className="max-w-3xl space-y-5 p-6">
      <FormMessage state={state} />

      <div className="panel space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Trabajo
        </h2>
        <Field label="Título" name="title" errors={state.errors}>
          <Input
            name="title"
            defaultValue={workOrder?.title}
            placeholder="Ej. Fuga en sello mecánico de bomba de zinc"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Activo" name="assetId" errors={state.errors}>
            <Select
              name="assetId"
              placeholder="— Selecciona —"
              defaultValue={workOrder?.assetId ?? ""}
              required
              options={assets.map((a) => ({
                value: a.id,
                label: `${a.tag} · ${a.name}`,
              }))}
            />
          </Field>
          <Field label="Tipo" name="type" errors={state.errors}>
            <Select
              name="type"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
              options={TYPES}
            />
          </Field>
          <Field label="Prioridad" name="priority" errors={state.errors}>
            <Select
              name="priority"
              defaultValue={workOrder?.priority ?? 3}
              options={PRIORITIES}
            />
          </Field>
          <Field label="Estado" name="status" errors={state.errors}>
            <Select
              name="status"
              defaultValue={workOrder?.status ?? "abierta"}
              options={STATUSES}
            />
          </Field>
          <Field
            label="Modo de falla"
            name="failureModeId"
            errors={state.errors}
            className={isCorrective ? "" : "opacity-50"}
            hint={
              isCorrective
                ? "Obligatorio: alimenta el Pareto y el análisis de causa raíz"
                : "Solo aplica a órdenes correctivas"
            }
          >
            <Select
              name="failureModeId"
              placeholder="— Selecciona —"
              defaultValue={workOrder?.failureModeId ?? ""}
              disabled={!isCorrective}
              options={failureModes.map((f) => ({
                value: f.id,
                label: `${f.name} (${f.category})`,
              }))}
            />
          </Field>
          <Field label="Responsable" name="assignedTo" errors={state.errors}>
            <Select
              name="assignedTo"
              placeholder="— Sin asignar —"
              defaultValue={workOrder?.assignedTo ?? ""}
              options={technicians.map((t) => ({
                value: t.id,
                label: t.specialty ? `${t.name} · ${t.specialty}` : t.name,
              }))}
            />
          </Field>
        </div>
        <Field label="Descripción" name="description" errors={state.errors}>
          <Textarea name="description" defaultValue={workOrder?.description ?? ""} />
        </Field>
      </div>

      <div className="panel space-y-4 p-5">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
            Tiempos
          </h2>
          <p className="mt-1 text-[11px] text-ink-400">
            De estas tres marcas salen el MTTR, el MTBF y la disponibilidad. Si son
            inexactas, los indicadores también lo serán.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Reportado" name="reportedAt" errors={state.errors}>
            <Input
              name="reportedAt"
              type="datetime-local"
              defaultValue={toLocalInput(workOrder?.reportedAt ?? new Date())}
              required
            />
          </Field>
          <Field label="Inicio de intervención" name="startedAt" errors={state.errors}>
            <Input
              name="startedAt"
              type="datetime-local"
              defaultValue={toLocalInput(workOrder?.startedAt)}
            />
          </Field>
          <Field label="Fin de intervención" name="finishedAt" errors={state.errors}>
            <Input
              name="finishedAt"
              type="datetime-local"
              defaultValue={toLocalInput(workOrder?.finishedAt)}
            />
          </Field>
        </div>
        <Field
          label="Parada del activo (minutos)"
          name="downtimeMinutes"
          errors={state.errors}
          hint="Tiempo real indisponible; puede exceder la ventana de reparación"
        >
          <Input
            name="downtimeMinutes"
            type="number"
            min={0}
            defaultValue={workOrder?.downtimeMinutes ?? 0}
          />
        </Field>
      </div>

      <div className="panel space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Horas y costos
        </h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field label="Horas estimadas" name="estimatedHours" errors={state.errors}>
            <Input
              name="estimatedHours"
              type="number"
              min={0}
              step="0.25"
              defaultValue={workOrder?.estimatedHours ?? "0"}
            />
          </Field>
          <Field label="Horas reales" name="laborHours" errors={state.errors}>
            <Input
              name="laborHours"
              type="number"
              min={0}
              step="0.25"
              defaultValue={workOrder?.laborHours ?? "0"}
            />
          </Field>
          <Field label={`Costo M.O. (${CURRENCY_SYMBOL})`} name="laborCost" errors={state.errors}>
            <Input
              name="laborCost"
              type="number"
              min={0}
              step="0.01"
              defaultValue={workOrder?.laborCost ?? "0"}
            />
          </Field>
          <Field label={`Costo repuestos (${CURRENCY_SYMBOL})`} name="partsCost" errors={state.errors}>
            <Input
              name="partsCost"
              type="number"
              min={0}
              step="0.01"
              defaultValue={workOrder?.partsCost ?? "0"}
            />
          </Field>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{workOrder ? "Guardar cambios" : "Crear orden"}</SubmitButton>
        <Link
          href="/ordenes"
          className="rounded-lg px-3 py-2 text-sm text-ink-400 transition hover:text-ink-100"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
