"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton, toLocalInput } from "@/components/form";
import { addMeterReading } from "@/lib/actions/meters";
import type { ActionState } from "@/lib/validation";

const INITIAL: ActionState = { ok: false };

export function ReadingForm({
  assets,
  defaultAssetId,
}: {
  assets: Array<{ id: number; tag: string; name: string; currentHours: number | null }>;
  defaultAssetId?: number;
}) {
  const [state, formAction] = useActionState(addMeterReading, INITIAL);

  return (
    <form action={formAction} className="space-y-4 px-5 py-4">
      <FormMessage state={state} />

      <Field label="Activo" name="assetId" errors={state.errors}>
        <Select
          name="assetId"
          required
          defaultValue={defaultAssetId ?? ""}
          placeholder="— Selecciona —"
          options={assets.map((a) => ({
            value: a.id,
            label: a.currentHours
              ? `${a.tag} · ${a.name} — ${Math.round(a.currentHours).toLocaleString()} h`
              : `${a.tag} · ${a.name}`,
          }))}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Lectura del horómetro (h)"
          name="hours"
          errors={state.errors}
          hint="Valor acumulado que marca el instrumento"
        >
          <Input name="hours" type="number" min={0} step="0.1" required />
        </Field>

        <Field label="Fecha y hora de la lectura" name="takenAt" errors={state.errors}>
          <Input
            name="takenAt"
            type="datetime-local"
            defaultValue={toLocalInput(new Date())}
            required
          />
        </Field>
      </div>

      <Field
        label="Nota"
        name="note"
        errors={state.errors}
        hint="Opcional. Anota aquí un reemplazo de instrumento o una lectura estimada."
      >
        <Input name="note" placeholder="Ej. horómetro reemplazado en dique" />
      </Field>

      <SubmitButton>Registrar lectura</SubmitButton>
    </form>
  );
}
