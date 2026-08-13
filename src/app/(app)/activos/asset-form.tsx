"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  Field,
  FormMessage,
  Input,
  Select,
  SubmitButton,
  Textarea,
  toDateInput,
} from "@/components/form";
import type { Asset } from "@/db/schema";
import type { ActionState } from "@/lib/validation";

const INITIAL: ActionState = { ok: false };

const CRITICALITY = [
  { value: "A", label: "A — parada de línea / riesgo de seguridad" },
  { value: "B", label: "B — impacto parcial en producción" },
  { value: "C", label: "C — sin impacto inmediato" },
];

const STATUS = [
  { value: "operando", label: "Operando" },
  { value: "standby", label: "Standby" },
  { value: "detenido", label: "Detenido" },
  { value: "baja", label: "Baja" },
];

export function AssetForm({
  currencySymbol,
  action,
  asset,
  parents,
}: {
  /** Símbolo de la moneda: llega del servidor, que es quien conoce la configuración. */
  currencySymbol: string;
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  asset?: Asset;
  parents: Array<{ id: number; tag: string; name: string }>;
}) {
  const [state, formAction] = useActionState(action, INITIAL);

  return (
    <form action={formAction} className="max-w-3xl space-y-5 p-6">
      <FormMessage state={state} />

      <div className="panel space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Identificación
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tag" name="tag" errors={state.errors} hint="Ej. EQ-101">
            <Input name="tag" defaultValue={asset?.tag} required />
          </Field>
          <Field label="Nombre" name="name" errors={state.errors}>
            <Input name="name" defaultValue={asset?.name} required />
          </Field>
          <Field
            label="Activo padre"
            name="parentId"
            errors={state.errors}
            hint="Define la jerarquía planta → línea → equipo"
          >
            <Select
              name="parentId"
              placeholder="— Sin padre (raíz) —"
              defaultValue={asset?.parentId ?? ""}
              options={parents.map((p) => ({
                value: p.id,
                label: `${p.tag} · ${p.name}`,
              }))}
            />
          </Field>
          <Field label="Ubicación" name="location" errors={state.errors}>
            <Input name="location" defaultValue={asset?.location ?? ""} />
          </Field>
        </div>
      </div>

      <div className="panel space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Criticidad y estado
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Criticidad" name="criticality" errors={state.errors}>
            <Select
              name="criticality"
              defaultValue={asset?.criticality ?? "C"}
              options={CRITICALITY}
            />
          </Field>
          <Field label="Estado" name="status" errors={state.errors}>
            <Select
              name="status"
              defaultValue={asset?.status ?? "operando"}
              options={STATUS}
            />
          </Field>
          <Field
            label={`Costo de parada por hora (${currencySymbol})`}
            name="downtimeCostPerHour"
            errors={state.errors}
            hint="Alimenta la priorización de OT en la fase 3"
          >
            <Input
              name="downtimeCostPerHour"
              type="number"
              min={0}
              step={1}
              defaultValue={asset?.downtimeCostPerHour ?? 0}
            />
          </Field>
          <Field label="Fecha de instalación" name="installedAt" errors={state.errors}>
            <Input
              name="installedAt"
              type="date"
              defaultValue={toDateInput(asset?.installedAt)}
            />
          </Field>
        </div>
      </div>

      <div className="panel space-y-4 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-300">
          Ficha técnica
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Fabricante" name="manufacturer" errors={state.errors}>
            <Input name="manufacturer" defaultValue={asset?.manufacturer ?? ""} />
          </Field>
          <Field label="Modelo" name="model" errors={state.errors}>
            <Input name="model" defaultValue={asset?.model ?? ""} />
          </Field>
          <Field label="N.º de serie" name="serialNumber" errors={state.errors}>
            <Input name="serialNumber" defaultValue={asset?.serialNumber ?? ""} />
          </Field>
        </div>
        <Field label="Notas" name="notes" errors={state.errors}>
          <Textarea name="notes" defaultValue={asset?.notes ?? ""} />
        </Field>
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton>{asset ? "Guardar cambios" : "Crear activo"}</SubmitButton>
        <Link
          href="/activos"
          className="rounded-lg px-3 py-2 text-sm text-ink-400 transition hover:text-ink-100"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
