"use client";

import { useEffect, useRef, useState } from "react";
import type { ActionState } from "@/lib/validation";

/**
 * Aviso emergente del resultado de una acción.
 *
 * Existe porque el mensaje de error vivía arriba del formulario y el botón de
 * guardar está abajo: al rechazar el servidor, el usuario pulsaba, no veía
 * nada y concluía que la aplicación no respondía. El mensaje estaba, solo que
 * a dos pantallas de distancia.
 *
 * Aparece centrado y hay que cerrarlo a mano. Un aviso que se desvanece solo
 * sirve para confirmar algo que salió bien; cuando algo falló y hay que leer
 * por qué, desaparecer es justo lo que no debe hacer.
 */
export function ActionDialog({ state }: { state: ActionState }) {
  const [abierto, setAbierto] = useState(false);
  const botonRef = useRef<HTMLButtonElement>(null);
  // Se guarda el mensaje para que el texto no desaparezca durante la
  // animación de cierre.
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (state.message && !state.ok) {
      setMensaje(state.message);
      setAbierto(true);
    }
  }, [state]);

  useEffect(() => {
    if (!abierto) return;
    botonRef.current?.focus();
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("keydown", alPulsar);
    return () => document.removeEventListener("keydown", alPulsar);
  }, [abierto]);

  if (!abierto || !mensaje) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="No se pudo guardar"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6"
      onClick={() => setAbierto(false)}
    >
      <div
        // El clic dentro no cierra: si el mensaje es largo, seleccionar texto
        // para copiarlo no debería descartarlo.
        onClick={(e) => e.stopPropagation()}
        className="max-w-md rounded-lg border border-bad-500/40 bg-ink-900 p-6 shadow-2xl shadow-black/50"
      >
        <h2 className="text-sm font-semibold text-bad-500">
          No se pudo guardar
        </h2>
        <p className="mt-2.5 text-sm leading-relaxed text-ink-200">{mensaje}</p>

        <div className="mt-5 flex justify-end">
          <button
            ref={botonRef}
            type="button"
            onClick={() => setAbierto(false)}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
