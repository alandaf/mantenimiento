"use client";

import { useActionState, useState, useTransition } from "react";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/form";
import {
  changeUserRole,
  createUser,
  toggleUserAccess,
} from "@/lib/actions/users";
import { ROLES } from "@/lib/roles";
import type { ActionState } from "@/lib/validation";

const INITIAL: ActionState = { ok: false };

const ROLE_OPTIONS = Object.entries(ROLES).map(([value, label]) => ({
  value,
  label,
}));

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  banned: boolean | null;
  createdAt: Date;
};

export function CreateUserForm() {
  const [state, formAction] = useActionState(createUser, INITIAL);

  return (
    <form action={formAction} className="space-y-4 px-5 py-4">
      <FormMessage state={state} />

      <Field label="Nombre" name="name" errors={state.errors}>
        <Input name="name" required placeholder="Matías Soto" />
      </Field>

      <Field label="Correo" name="email" errors={state.errors}>
        <Input
          name="email"
          type="email"
          required
          placeholder="segundo.maquinas@naviera.cl"
        />
      </Field>

      <Field
        label="Contraseña inicial"
        name="password"
        errors={state.errors}
        hint="Mínimo 10 caracteres. Entrégasela en persona y pídele que la cambie."
      >
        <Input name="password" type="text" required minLength={10} />
      </Field>

      <Field label="Rol" name="role" errors={state.errors}>
        <Select name="role" defaultValue="tecnico" options={ROLE_OPTIONS} />
      </Field>

      <SubmitButton>Crear cuenta</SubmitButton>
    </form>
  );
}

export function UserRowActions({
  user,
  isSelf,
}: {
  user: UserRow;
  isSelf: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<ActionState | null>(null);

  if (isSelf) {
    return (
      <span className="text-[11px] text-ink-600">Tu cuenta</span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <select
          defaultValue={user.role ?? "lectura"}
          disabled={pending}
          onChange={(e) =>
            startTransition(async () =>
              setMessage(await changeUserRole(user.id, e.target.value)),
            )
          }
          className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-[11px] text-ink-200 outline-none focus:border-brand-500 disabled:opacity-50"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () =>
              setMessage(await toggleUserAccess(user.id, !user.banned)),
            )
          }
          className={`rounded-md border px-2 py-1 text-[11px] transition disabled:opacity-50 ${
            user.banned
              ? "border-ok-500/40 text-ok-500 hover:bg-ok-500/10"
              : "border-ink-700 text-ink-400 hover:bg-ink-800 hover:text-bad-500"
          }`}
        >
          {user.banned ? "Habilitar" : "Deshabilitar"}
        </button>
      </div>

      {message?.message && (
        <span
          className={`text-[11px] ${message.ok ? "text-ok-500" : "text-bad-500"}`}
        >
          {message.message}
        </span>
      )}
    </div>
  );
}
