/**
 * Requisito de cierre: la pauta tiene que estar resuelta.
 *
 * No se cierra una orden con pasos en blanco. La regla no viene de un criterio
 * de diseño sino de cómo se trabaja a bordo: cada paso tiene que quedar con el
 * nombre de quien lo asumió.
 *
 * Y "resuelto" no significa "conforme". Un paso puede quedar **no conforme** o
 * **no aplica** y la orden se cierra igual: lo que no se admite es dejarlo en
 * blanco. La diferencia importa —una pauta donde todo sale conforme siempre es
 * sospechosa, una donde hay hallazgos registrados es un trabajo real—.
 *
 * La firma no es un candado, es una responsabilidad. Si alguien marca un paso
 * sin ejecutarlo y el equipo falla después, el registro dice quién fue el
 * último que declaró haberlo tocado.
 */

export type PasoPendiente = {
  sequence: number;
  description: string;
};

export type VerificacionCierre =
  | { puede: true }
  | { puede: false; pendientes: PasoPendiente[]; mensaje: string };

export function puedeCerrarse(
  pasos: ReadonlyArray<{ sequence: number; description: string; result: string | null }>,
): VerificacionCierre {
  const pendientes = pasos
    .filter((p) => p.result === null)
    .map((p) => ({ sequence: p.sequence, description: p.description }));

  if (pendientes.length === 0) return { puede: true };

  const lista = pendientes
    .slice(0, 3)
    .map((p) => `${p.sequence}. ${p.description}`)
    .join(" · ");
  const resto = pendientes.length > 3 ? ` y ${pendientes.length - 3} más` : "";

  return {
    puede: false,
    pendientes,
    mensaje:
      `No se puede cerrar: quedan ${pendientes.length} paso${pendientes.length > 1 ? "s" : ""} sin registrar. ` +
      `Cada paso debe quedar como conforme, no conforme o no aplica, con el nombre de quien lo asume. ` +
      `Pendientes: ${lista}${resto}.`,
  };
}
