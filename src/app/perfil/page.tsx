import Link from "next/link";
import { BRAND, BrandMark } from "@/components/brand";
import { PageHeader, Panel } from "@/components/ui";
import { isSuperadmin, ROLES, type Role } from "@/lib/roles";
import { requireSession } from "@/lib/session";
import { PasswordForm, ProfileForm } from "./profile-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi perfil" };

/**
 * Vive fuera de `(app)` y de `(platform)` porque lo usa todo el mundo: el
 * operador de la plataforma no tiene instalación y el árbol de la aplicación
 * exige una, así que una sola página aquí evita duplicarla en ambos.
 */
export default async function PerfilPage() {
  const session = await requireSession();
  const esOperador = isSuperadmin(session.user.role);
  const volverA = esOperador ? "/plataforma" : "/dashboard";

  return (
    <div className="min-h-screen">
      <div className="flex items-center gap-2.5 border-b border-ink-800 bg-ink-900 px-6 py-3">
        <Link href={volverA} className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="text-sm font-bold tracking-wide">{BRAND.product}</span>
        </Link>
      </div>

      <PageHeader
        title="Mi perfil"
        subtitle={session.user.email}
        actions={
          <Link
            href={volverA}
            className="rounded-lg border border-ink-700 px-3.5 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
          >
            Volver
          </Link>
        }
      />

      <div className="mx-auto grid max-w-4xl gap-5 p-6 md:grid-cols-2">
        <Panel title="Datos">
          <ProfileForm name={session.user.name} />
          <div className="border-t border-ink-800 px-5 py-3.5">
            <p className="text-[11px] leading-relaxed text-ink-400">
              Rol:{" "}
              <span className="text-brand-300">
                {esOperador
                  ? "Operador de plataforma"
                  : (ROLES[(session.user.role ?? "lectura") as Role] ??
                    session.user.role)}
              </span>
              <br />
              El correo y el rol los cambia el administrador de tu instalación,
              no tú: si pudieras cambiarte el rol, no habría roles.
            </p>
          </div>
        </Panel>

        <Panel title="Contraseña">
          <PasswordForm />
          <div className="border-t border-ink-800 px-5 py-3.5">
            <p className="text-[11px] leading-relaxed text-ink-400">
              Al cambiarla se cierran las demás sesiones abiertas. Si la cambias
              porque alguien más la conocía, dejar sus sesiones vivas no
              arreglaría nada.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}
