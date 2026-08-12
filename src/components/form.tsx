"use client";

import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/validation";

const inputCls =
  "w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none transition placeholder:text-ink-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

export function Field({
  label,
  name,
  errors,
  hint,
  children,
  className = "",
}: {
  label: string;
  name: string;
  errors?: Record<string, string[]>;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const error = errors?.[name]?.[0];
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-medium text-ink-300">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-[11px] text-bad-500">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>
      ) : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} rows={3} className={inputCls} />;
}

export function Select({
  options,
  placeholder,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
}) {
  return (
    <select {...props} className={inputCls}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? "Guardando…" : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ActionState }) {
  if (!state.message) return null;
  return (
    <p
      className={`rounded-lg px-3.5 py-2.5 text-sm ${
        state.ok
          ? "bg-ok-500/10 text-ok-500"
          : "bg-bad-500/10 text-bad-500"
      }`}
    >
      {state.message}
    </p>
  );
}

/** Fecha-hora para <input type="datetime-local">, en hora local. */
export function toLocalInput(date: Date | null | undefined): string {
  if (!date) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

/** Solo fecha, para <input type="date">. */
export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}
