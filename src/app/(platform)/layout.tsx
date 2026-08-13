import Link from "next/link";
import { BRAND, BrandMark } from "@/components/brand";
import { UserMenu } from "@/components/user-menu";
import { requireSuperadmin } from "@/lib/platform";

/**
 * Consola de plataforma.
 *
 * Vive en su propio grupo de rutas, fuera de `(app)`, porque el operador no
 * pertenece a ninguna instalación: el layout de la aplicación exige una
 * organización activa para poder filtrar los datos, y aquí no la hay ni debe
 * haberla. Separarlos evita tener que llenar de excepciones el árbol normal.
 */
export default async function PlatformLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSuperadmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-ink-800 bg-ink-900 px-6 py-3">
        <Link href="/plataforma" className="flex items-center gap-2.5">
          <BrandMark size={30} />
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-wide">
              {BRAND.product}
            </span>
            <span className="block text-[11px] text-brand-300">
              Consola de plataforma
            </span>
          </span>
        </Link>

        <div className="w-56">
          <UserMenu
            name={session.user.name}
            email={session.user.email}
            role="Operador de plataforma"
          />
        </div>
      </header>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
