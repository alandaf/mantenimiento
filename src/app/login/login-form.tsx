"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "@/lib/auth-client";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const form = new FormData(e.currentTarget);
    const { error } = await signIn.email({
      email: String(form.get("email") ?? "").trim(),
      password: String(form.get("password") ?? ""),
    });

    if (error) {
      // Mensaje deliberadamente genérico: distinguir "no existe" de "clave
      // incorrecta" le confirma a un atacante qué correos son válidos.
      setError(
        error.status === 403
          ? "Esta cuenta está deshabilitada. Contacta al administrador."
          : "Correo o contraseña incorrectos.",
      );
      setPending(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  const input =
    "w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

  return (
    <form onSubmit={onSubmit} className="mt-5 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-300">Correo</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className={input}
          placeholder="jefe.maquinas@naviera.cl"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-ink-300">
          Contraseña
        </span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
        />
      </label>

      {error && (
        <p className="rounded-lg bg-bad-500/10 px-3 py-2.5 text-xs text-bad-500">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending && (
          <span className="size-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        )}
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
