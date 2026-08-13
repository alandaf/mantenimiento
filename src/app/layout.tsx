import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "PMS SIMARP",
    template: "%s · PMS SIMARP",
  },
  description:
    "Planned Maintenance System: mantenimiento por horas de marcha, KPIs de confiabilidad y análisis de causa raíz.",
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
