import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Marca de la aplicación.
 *
 * El logo se busca en `public/`. Si todavía no está, se muestra un monograma
 * en su lugar: preferible a un icono roto mientras el archivo no exista, y
 * permite desplegar sin depender de que alguien recuerde subirlo.
 */
export const BRAND = {
  name: "SIMARP",
  product: "PMS SIMARP",
  tagline: "Planned Maintenance System",
} as const;

const CANDIDATES = [
  "simarp-logo.svg",
  "simarp-logo.png",
  "simarp-logo.webp",
] as const;

/** Ruta pública del logo, o `null` si aún no se ha añadido. */
export function logoPath(): string | null {
  for (const file of CANDIDATES) {
    if (existsSync(path.join(process.cwd(), "public", file))) return `/${file}`;
  }
  return null;
}

export function BrandMark({ size = 36 }: { size?: number }) {
  const logo = logoPath();

  if (logo) {
    return (
      // Sin next/image: el logo es un activo local pequeño y estático, y el
      // optimizador solo añadiría una capa que aquí no compensa.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logo}
        alt={BRAND.name}
        width={size}
        height={size}
        className="shrink-0 rounded-lg bg-white object-contain p-0.5"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-label={BRAND.name}
      className="grid shrink-0 place-items-center rounded-lg bg-brand-500 font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      SP
    </span>
  );
}
