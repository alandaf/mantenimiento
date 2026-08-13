import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { NavLink } from "@/components/nav-link";

export const metadata: Metadata = {
  title: "GMAO-AI · Gálvanica Operaciones Inteligentes",
  description:
    "Gestión de mantenimiento con KPIs de confiabilidad calculados sobre datos reales.",
};

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: "▦" },
  { href: "/ordenes", label: "Órdenes de trabajo", icon: "▤" },
  { href: "/priorizacion", label: "Priorización IA", icon: "✳" },
  { href: "/causa-raiz", label: "Causa raíz", icon: "◆" },
  { href: "/preventivo", label: "Plan preventivo", icon: "◷" },
  { href: "/horometros", label: "Horómetros", icon: "⏱" },
  { href: "/activos", label: "Activos", icon: "⚙" },
  { href: "/importar", label: "Importar Excel", icon: "↥" },
  { href: "/reportes", label: "Reportes PDF", icon: "▣" },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <div className="flex min-h-screen">
          <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-800 bg-ink-900 lg:flex">
            <Link href="/dashboard" className="flex items-center gap-2.5 px-5 py-6">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-500 text-lg font-bold">
                G
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-bold tracking-wide">GMAO-AI</span>
                <span className="block text-[11px] text-ink-400">Gálvanica</span>
              </span>
            </Link>

            <nav className="flex flex-1 flex-col gap-1 px-3">
              {NAV.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  <span className="text-ink-400">{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="m-3 rounded-lg border border-ink-800 bg-ink-850 p-3">
              <p className="text-[11px] leading-relaxed text-ink-400">
                <span className="font-semibold text-ink-300">Preventivo por horas</span>
                <br />
                Rutinas disparadas por marcha real, no por calendario.
              </p>
            </div>
          </aside>

          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
