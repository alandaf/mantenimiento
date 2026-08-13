import Link from "next/link";
import { BRAND, BrandMark } from "@/components/brand";
import { NavLink } from "@/components/nav-link";
import { UserMenu } from "@/components/user-menu";
import { hasRole, requireSession, ROLES, type Role } from "@/lib/session";

/**
 * Layout de la aplicación autenticada.
 *
 * `requireSession()` se llama una sola vez aquí y protege todo el árbol: si
 * cada página tuviera que acordarse de pedirla, la primera que se olvidara
 * quedaría abierta sin que nadie lo note.
 */

const NAV: Array<{ href: string; label: string; icon: string; min: Role }> = [
  { href: "/dashboard", label: "Dashboard", icon: "▦", min: "lectura" },
  { href: "/ordenes", label: "Órdenes de trabajo", icon: "▤", min: "lectura" },
  { href: "/priorizacion", label: "Priorización IA", icon: "✳", min: "tecnico" },
  { href: "/causa-raiz", label: "Causa raíz", icon: "◆", min: "tecnico" },
  { href: "/preventivo", label: "Plan preventivo", icon: "◷", min: "lectura" },
  { href: "/horometros", label: "Horómetros", icon: "⏱", min: "tecnico" },
  { href: "/activos", label: "Activos", icon: "⚙", min: "lectura" },
  { href: "/importar", label: "Importar Excel", icon: "↥", min: "planificador" },
  { href: "/reportes", label: "Reportes PDF", icon: "▣", min: "lectura" },
  { href: "/usuarios", label: "Usuarios", icon: "◐", min: "admin" },
];

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  const role = (session.user.role ?? "lectura") as Role;

  // El menú solo muestra lo que el rol puede abrir. La comprobación real vive
  // en cada acción del servidor: ocultar un enlace no es seguridad.
  const visible = NAV.filter((item) => hasRole(role, item.min));

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-6">
          <BrandMark size={36} />
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-wide">
              {BRAND.product}
            </span>
            <span className="block text-[11px] text-ink-400">{BRAND.tagline}</span>
          </span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          {visible.map((item) => (
            <NavLink key={item.href} href={item.href}>
              <span className="text-ink-400">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <UserMenu
          name={session.user.name}
          email={session.user.email}
          role={ROLES[role] ?? role}
        />
      </aside>

      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
