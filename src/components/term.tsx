"use client";

import { useCallback, useRef, useState } from "react";
import { GLOSSARY, type GlossaryEntry, type GlossaryKey } from "@/lib/glossary";

/**
 * Explicación emergente de un término del rubro.
 *
 * El recuadro se posiciona con `fixed` y coordenadas calculadas, no con
 * `absolute`: las tablas viven dentro de contenedores con desplazamiento
 * horizontal, y ahí un elemento absoluto se recorta contra el borde. Con
 * `fixed` sale del recorte y se puede sujetar al borde de la ventana.
 *
 * Se abre con el puntero y también con el teclado —es un `button`, así que
 * entra en el orden de tabulación— y en pantallas táctiles con un toque, donde
 * no existe el hover.
 */
export function Term({
  k,
  children,
  className = "",
}: {
  k: GlossaryKey;
  /** Texto visible. Sin él se muestra solo el signo de interrogación. */
  children?: React.ReactNode;
  className?: string;
}) {
  // Tipado explícito: `as const` en el glosario estrecha cada entrada a su
  // literal, y las que no traen fórmula perderían la propiedad.
  const entry: GlossaryEntry = GLOSSARY[k];
  const ref = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const abrir = useCallback(() => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;

    const ANCHO = 288; // w-72
    const MARGEN = 12;

    // Sujeto al borde derecho: sin esto, un término al final de una tabla
    // abriría el recuadro medio fuera de la pantalla.
    const left = Math.min(
      Math.max(MARGEN, r.left),
      window.innerWidth - ANCHO - MARGEN,
    );

    // Si no cabe abajo, se abre hacia arriba. Es lo que pasa con la última fila
    // de una tabla larga.
    const cabeAbajo = window.innerHeight - r.bottom > 220;
    const top = cabeAbajo ? r.bottom + 8 : Math.max(MARGEN, r.top - 8 - 200);

    setPos({ top, left });
  }, []);

  const cerrar = useCallback(() => setPos(null), []);

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={`Qué significa: ${entry.title}`}
        onMouseEnter={abrir}
        onMouseLeave={cerrar}
        onFocus={abrir}
        onBlur={cerrar}
        onClick={(e) => {
          // En táctil no hay hover: el toque abre y cierra.
          e.preventDefault();
          pos ? cerrar() : abrir();
        }}
        className={`inline-flex items-center gap-1 align-middle text-left ${className}`}
      >
        {children}
        <span
          aria-hidden
          className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-ink-600 text-[9px] font-bold leading-none text-ink-400 transition hover:border-brand-500 hover:text-brand-300"
        >
          ?
        </span>
      </button>

      {pos && (
        <span
          role="tooltip"
          style={{ top: pos.top, left: pos.left }}
          // `normal-case` y `tracking-normal` no son adorno: las etiquetas de
          // los KPI llevan `uppercase`, y el recuadro lo heredaba, dejando el
          // párrafo entero en mayúsculas e ilegible.
          className="pointer-events-none fixed z-50 w-72 rounded-lg border border-ink-700 bg-ink-850 p-3 text-left normal-case tracking-normal shadow-xl shadow-black/40"
        >
          <span className="block text-xs font-semibold text-ink-100">
            {entry.title}
          </span>
          <span className="mt-1.5 block text-[11px] leading-relaxed text-ink-300">
            {entry.body}
          </span>
          {entry.formula && (
            <span className="mt-2 block border-t border-ink-700 pt-2 font-mono text-[10px] leading-relaxed text-ink-400">
              {entry.formula}
            </span>
          )}
        </span>
      )}
    </>
  );
}
