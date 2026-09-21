"use client";

import { useEffect } from "react";

/**
 * Pantalla de error.
 *
 * Existe por un caso concreto: al desplegar una versión nueva mientras alguien
 * tiene la aplicación abierta, su navegador conserva el código anterior. Los
 * identificadores de las acciones del servidor cambian en cada compilación, así
 * que el primer envío después del despliegue falla y React muestra un texto en
 * inglés que parece una caída del sistema.
 *
 * No se puede evitar el desfase sin dejar de desplegar. Lo que sí se puede es
 * que el mensaje diga qué pasó y qué hacer, en vez de "a client-side exception
 * has occurred".
 */

/** Firmas típicas del desfase entre la página cargada y el servidor nuevo. */
const DESFASE = /Server Action|older or newer deployment|ChunkLoadError|Loading chunk|dynamically imported module/i;

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const esDesfase = DESFASE.test(`${error.message} ${error.stack ?? ""}`);

  useEffect(() => {
    console.error("Error en la aplicación:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-6">
      <div className="max-w-lg rounded-lg border border-ink-800 bg-ink-900 p-8 text-center">
        <h1 className="text-lg font-semibold text-ink-100">
          {esDesfase
            ? "Se publicó una versión nueva mientras trabajabas"
            : "Algo falló al cargar esta página"}
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-ink-400">
          {esDesfase ? (
            <>
              Tu navegador tenía la versión anterior abierta. No se perdió nada
              de lo que ya habías guardado: basta con recargar para seguir.
            </>
          ) : (
            <>
              El error quedó registrado. Si vuelve a ocurrir al hacer lo mismo,
              avísale a quien administra el sistema e indícale el código de
              abajo.
            </>
          )}
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            // Recarga completa, no `reset()`: si el código del navegador quedó
            // desfasado, reintentar con el mismo código vuelve a fallar.
            onClick={() => window.location.reload()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-600"
          >
            Recargar la página
          </button>
          {!esDesfase && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-ink-700 px-4 py-2 text-sm text-ink-300 transition hover:bg-ink-800 hover:text-ink-100"
            >
              Reintentar
            </button>
          )}
        </div>

        {error.digest && (
          <p className="num mt-5 text-[11px] text-ink-600">
            Código del error: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
