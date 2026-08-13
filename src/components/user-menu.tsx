"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { signOut } from "@/lib/auth-client";

export function UserMenu({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="m-3 rounded-lg border border-ink-800 bg-ink-850 p-3">
      <p className="truncate text-xs font-medium text-ink-100" title={email}>
        {name}
      </p>
      <p className="mt-0.5 text-[11px] text-brand-300">{role}</p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await signOut();
            router.replace("/login");
            router.refresh();
          })
        }
        className="mt-2.5 w-full rounded-md border border-ink-700 px-2 py-1.5 text-[11px] text-ink-400 transition hover:bg-ink-800 hover:text-ink-100 disabled:opacity-50"
      >
        {pending ? "Saliendo…" : "Cerrar sesión"}
      </button>
    </div>
  );
}
