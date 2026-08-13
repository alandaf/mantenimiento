import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GMAO-AI · Gálvanica Operaciones Inteligentes",
  description:
    "Gestión de mantenimiento con KPIs de confiabilidad calculados sobre datos reales.",
};

/**
 * Layout raíz deliberadamente mínimo: la navegación vive en (app), que exige
 * sesión. Así /login no puede renderizar el menú de una aplicación a la que
 * todavía no se entró.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
