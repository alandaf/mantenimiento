"use client";

import { useActionState } from "react";
import { Field, FormMessage, Input, SubmitButton } from "@/components/form";
import { changeOwnPassword, updateProfile } from "@/lib/actions/profile";
import type { ActionState } from "@/lib/validation";

const INITIAL: ActionState = { ok: false };

export function ProfileForm({ name }: { name: string }) {
  const [state, formAction] = useActionState(updateProfile, INITIAL);

  return (
    <form action={formAction} className="space-y-4 px-5 py-4">
      <FormMessage state={state} />

      <Field label="Nombre" name="name" errors={state.errors}>
        <Input name="name" required defaultValue={name} />
      </Field>

      <SubmitButton>Guardar nombre</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction] = useActionState(changeOwnPassword, INITIAL);

  return (
    <form action={formAction} className="space-y-4 px-5 py-4">
      <FormMessage state={state} />

      <Field label="Contraseña actual" name="currentPassword" errors={state.errors}>
        <Input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>

      <Field
        label="Nueva contraseña"
        name="newPassword"
        errors={state.errors}
        hint="Mínimo 10 caracteres."
      >
        <Input
          name="newPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>

      <Field label="Repite la nueva" name="confirmPassword" errors={state.errors}>
        <Input
          name="confirmPassword"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
        />
      </Field>

      <SubmitButton>Cambiar contraseña</SubmitButton>
    </form>
  );
}
