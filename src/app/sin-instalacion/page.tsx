import { BrandMark } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { requireSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sin instalación" };

/**
 * Cuenta válida pero sin buque asignado.
 *
 * Vive fuera de `(app)` a propósito: aquel árbol da por hecho que hay una
 * organización con la que filtrar los datos, que es justo lo que aquí falta.
 */
export default async function SinInstalacionPage() {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-md rounded-lg border border-ink-800 bg-ink-900 p-8 text-center">
        <BrandMark size={44} />
        <h1 className="mt-4 text-lg font-semibold text-ink-100">
          Tu cuenta no tiene instalación asignada
        </h1>
        <p className="mt-3 text-sm text-ink-400">
          <span className="text-ink-200">{session.user.email}</span> existe, pero
          no está asociada a ningún buque ni planta, así que no hay datos que
          mostrar. Pide al administrador de tu instalación que te asigne uno.
        </p>
        <div className="mt-6">
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            role="Sin instalación"
          />
        </div>
      </div>
    </div>
  );
}
