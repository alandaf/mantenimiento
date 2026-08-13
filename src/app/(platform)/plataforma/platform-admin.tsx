"use client";

import { useActionState, useEffect, useState } from "react";
import { Field, FormMessage, Input, Select, SubmitButton } from "@/components/form";
import {
  createInstallation,
  createInstallationAdmin,
} from "@/lib/actions/platform";
import type { ActionState } from "@/lib/validation";

const INITIAL: ActionState = { ok: false };

const CURRENCIES = [
  { value: "CLP", label: "CLP · pesos chilenos" },
  { value: "PEN", label: "PEN · soles peruanos" },
  { value: "USD", label: "USD · dólares" },
  { value: "EUR", label: "EUR · euros" },
  { value: "MXN", label: "MXN · pesos mexicanos" },
  { value: "COP", label: "COP · pesos colombianos" },
  { value: "ARS", label: "ARS · pesos argentinos" },
  { value: "BRL", label: "BRL · reales" },
];

const LOCALES = [
  { value: "es-CL", label: "Chile" },
  { value: "es-PE", label: "Perú" },
  { value: "es-MX", label: "México" },
  { value: "es-CO", label: "Colombia" },
  { value: "es-AR", label: "Argentina" },
  { value: "es-ES", label: "España" },
  { value: "en-US", label: "Estados Unidos" },
  { value: "pt-BR", label: "Brasil" },
];

/** Deriva el identificador del nombre: nadie debería escribirlo a mano. */
function toSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function CreateInstallationForm() {
  const [state, formAction] = useActionState(createInstallation, INITIAL);
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);

  // Tras un alta correcta el formulario se vacía. El identificador es estado
  // controlado, así que no se limpia solo, y dejarlo puesto invita a crear la
  // siguiente instalación con el identificador de la anterior.
  useEffect(() => {
    if (state.ok) {
      setSlug("");
      setTouched(false);
    }
  }, [state]);

  return (
    <form action={formAction} className="space-y-4 px-5 py-4">
      <FormMessage state={state} />

      <Field label="Nombre" name="name" errors={state.errors}>
        <Input
          name="name"
          required
          placeholder="M/N Puerto Montt"
          onChange={(e) => {
            if (!touched) setSlug(toSlug(e.target.value));
          }}
        />
      </Field>

      <Field
        label="Identificador"
        name="slug"
        errors={state.errors}
        hint="Se usa en URLs y no cambia después. Se propone desde el nombre."
      >
        <Input
          name="slug"
          required
          value={slug}
          onChange={(e) => {
            setTouched(true);
            setSlug(e.target.value);
          }}
          placeholder="mn-puerto-montt"
        />
      </Field>

      <Field label="Moneda" name="currency" errors={state.errors}>
        <Select name="currency" defaultValue="CLP" options={CURRENCIES} />
      </Field>

      <Field label="Formato regional" name="locale" errors={state.errors}>
        <Select name="locale" defaultValue="es-CL" options={LOCALES} />
      </Field>

      <SubmitButton>Crear instalación</SubmitButton>
    </form>
  );
}

export function CreateAdminForm({
  installations,
}: {
  installations: Array<{ id: string; name: string; admins: number }>;
}) {
  const [state, formAction] = useActionState(createInstallationAdmin, INITIAL);

  // El desplegable apunta siempre a la primera instalación sin administrador.
  //
  // Tiene que ser estado controlado y reajustarse cuando cambia la lista:
  // React conserva la selección del DOM entre renders, así que tras crear un
  // buque nuevo el desplegable seguía marcando el anterior — y crear la cuenta
  // de mando en el barco equivocado es un error caro de deshacer.
  const pending = installations.find((i) => i.admins === 0) ?? installations[0];
  const [selected, setSelected] = useState(pending?.id ?? "");

  useEffect(() => {
    if (pending && !installations.some((i) => i.id === selected)) {
      setSelected(pending.id);
    }
  }, [installations, pending, selected]);

  useEffect(() => {
    if (state.ok && pending) setSelected(pending.id);
  }, [state, pending]);

  if (installations.length === 0) {
    return (
      <p className="px-5 py-4 text-xs text-ink-400">
        Crea primero una instalación.
      </p>
    );
  }

  // Las que aún no tienen administrador van primero: es el trabajo pendiente.
  const ordered = [...installations].sort((a, b) => a.admins - b.admins);
  const options = ordered.map((i) => ({
    value: i.id,
    label: i.admins === 0 ? `${i.name} — sin administrador` : i.name,
  }));

  return (
    <form action={formAction} className="space-y-4 px-5 py-4">
      <FormMessage state={state} />

      <Field label="Instalación" name="organizationId" errors={state.errors}>
        <Select
          name="organizationId"
          options={options}
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        />
      </Field>

      <Field label="Nombre" name="name" errors={state.errors}>
        <Input name="name" required placeholder="Rodrigo Vergara" />
      </Field>

      <Field label="Correo" name="email" errors={state.errors}>
        <Input
          name="email"
          type="email"
          required
          placeholder="jefe.maquinas@naviera.cl"
        />
      </Field>

      <Field
        label="Contraseña inicial"
        name="password"
        errors={state.errors}
        hint="Mínimo 10 caracteres. Entrégasela por un canal aparte y pídele que la cambie."
      >
        <Input name="password" type="text" required minLength={10} />
      </Field>

      <SubmitButton>Crear administrador</SubmitButton>
    </form>
  );
}
