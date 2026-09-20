/**
 * Reglas de aprobación de trabajos.
 *
 * Puras y sin base de datos, para poder probarlas: es la barrera que impide
 * que quien ejecutó una reparación en un equipo crítico sea quien certifique
 * que quedó bien.
 */

export type EntradaAprobacion = {
  /** Estado actual de la orden. */
  estado: string;
  /** `true` si ya tiene aprobación registrada. */
  yaAprobada: boolean;
  criticidad: string;
  esSistemaDeSeguridad: boolean;
  /** Correo de quien ejecutó el trabajo, o `null` si no hay responsable. */
  correoEjecutor: string | null;
  /** Correo de quien intenta aprobar. */
  correoAprobador: string;
};

export type ResultadoAprobacion =
  | { puede: true }
  | { puede: false; motivo: string };

/**
 * Un trabajo exige la firma de un tercero cuando el equipo es crítico o
 * pertenece a un sistema de seguridad. En el resto basta con cerrarlo: pedir
 * doble firma para cambiar un filtro convierte el control en un trámite que
 * la gente aprende a saltarse.
 */
export function exigeSegundaFirma(
  criticidad: string,
  esSistemaDeSeguridad: boolean,
): boolean {
  return criticidad === "critica" || esSistemaDeSeguridad;
}

export function puedeAprobar(e: EntradaAprobacion): ResultadoAprobacion {
  if (e.estado !== "cerrada") {
    return {
      puede: false,
      motivo: "Solo se aprueba una orden cerrada: primero hay que ejecutarla.",
    };
  }

  if (e.yaAprobada) {
    return { puede: false, motivo: "Esta orden ya estaba aprobada." };
  }

  if (!exigeSegundaFirma(e.criticidad, e.esSistemaDeSeguridad)) {
    return { puede: true };
  }

  // La comparación va en minúsculas: el correo de la ficha de dotación y el de
  // la cuenta de acceso los escriben personas distintas en momentos distintos.
  const mismo =
    e.correoEjecutor !== null &&
    e.correoEjecutor.trim().toLowerCase() ===
      e.correoAprobador.trim().toLowerCase();

  if (mismo) {
    return {
      puede: false,
      motivo:
        "No puedes aprobar un trabajo que ejecutaste tú. Por ser un equipo crítico, debe revisarlo otra persona.",
    };
  }

  return { puede: true };
}
