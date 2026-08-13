"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { updateSettings } from "@/lib/actions/settings";
import type { ActionState } from "@/lib/validation";

const INITIAL: ActionState = { ok: false };

export function SettingsForm({
  current,
  currencies,
  locales,
}: {
  current: {
    installationName: string;
    currency: string;
    locale: string;
    notes: string | null;
  };
  currencies: Array<{ value: string; label: string }>;
  locales: Array<{ value: string; label: string }>;
}) {
  const [state, formAction] = useActionState(updateSettings, INITIAL);

  return (
    <form action={formAction} className="space-y-4 px-5 py-4">
      <FormMessage state={state} />

      <Field
        label="Nombre de la instalación"
        name="installationName"
        errors={state.errors}
        hint="Aparece en el encabezado del reporte mensual"
      >
        <Input
          name="installationName"
          defaultValue={current.installationName}
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Moneda"
          name="currency"
          errors={state.errors}
          hint="Alcanza a la interfaz, el PDF y los análisis de IA"
        >
          <Select
            name="currency"
            defaultValue={current.currency}
            options={currencies}
          />
        </Field>

        <Field
          label="Formato regional"
          name="locale"
          errors={state.errors}
          hint="Separadores de miles, nombres de mes y orden de fecha"
        >
          <Select name="locale" defaultValue={current.locale} options={locales} />
        </Field>
      </div>

      <p className="rounded-lg border border-warn-500/25 bg-warn-500/5 px-3.5 py-2.5 text-[11px] leading-relaxed text-warn-500">
        Cambiar la moneda <strong>reformatea</strong> los montos, no los
        convierte: un costo de 1.500.000 seguirá siendo 1.500.000 con el nuevo
        símbolo. Cámbiala solo si se registró con la moneda equivocada desde el
        principio.
      </p>

      <Field label="Notas" name="notes" errors={state.errors}>
        <Textarea name="notes" defaultValue={current.notes ?? ""} />
      </Field>

      <SubmitButton>Guardar configuración</SubmitButton>
    </form>
  );
}
