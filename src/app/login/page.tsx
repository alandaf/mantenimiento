import { redirect } from "next/navigation";
import { BRAND, BrandMark } from "@/components/brand";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acceso" };

export default async function LoginPage() {
  // Quien ya tiene sesión no debe ver el formulario.
  if (await getSession()) redirect("/dashboard");

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex items-center gap-3">
          <BrandMark size={44} />
          <div className="leading-tight">
            <p className="text-base font-bold tracking-wide">{BRAND.product}</p>
            <p className="text-[11px] text-ink-400">{BRAND.tagline}</p>
          </div>
        </div>

        <div className="panel p-6">
          <h1 className="text-lg font-bold">Iniciar sesión</h1>
          <p className="mt-1 text-xs text-ink-400">
            Usa el correo que te asignó el administrador de tu instalación.
          </p>
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-600">
          ¿Sin cuenta? Las cuentas las crea el administrador de tu buque o planta.
          No hay registro público.
        </p>
      </div>
    </main>
  );
}
