import type { Criticality } from "./risk";

/**
 * Reglas obligatorias de prioridad.
 *
 * Se aplican **antes** que el score de riesgo y no son negociables. El score
 * ordena por urgencia económica y operativa; estas reglas responden otra
 * pregunta: qué no puede quedar abajo aunque la aritmética diga lo contrario.
 *
 * La diferencia importa. Un detector de gas con pocos días de antigüedad, un
 * solo evento y bajo costo de parada saca un score mediocre, porque el score
 * mide impacto en producción. Pero un detector de gas fuera de servicio es lo
 * último que debería esperar en una planta de GLP.
 *
 * Por eso el piso de prioridad lo fija la regla, la IA lo recibe ya impuesto y
 * **no puede bajarlo**. Puede reordenar dentro de una misma categoría y puede
 * subir algo, nunca degradar lo que una regla marcó.
 */

/** Categorías de piso, de mayor a menor exigencia. */
export type SafetyFloor = "critica" | "alta" | "media" | "baja";

const ORDEN: Record<SafetyFloor, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baja: 1,
};

export type SafetyInput = {
  /** El activo pertenece a un sistema de seguridad: RCI, detección de gas, parada de emergencia. */
  esSistemaDeSeguridad: boolean;
  /** La falla reportada compromete a personas o al proceso. */
  afectaSeguridad: boolean;
  criticality: Criticality;
  /** El activo tiene respaldo operativo —una bomba gemela, por ejemplo—. */
  tieneRespaldo: boolean;
  /** La falla detiene o reduce producción. */
  afectaProduccion: boolean;
};

export type SafetyResult = {
  /** Piso de prioridad que no puede reducirse. */
  floor: SafetyFloor;
  /** Regla que lo determinó, para mostrarla y guardarla. */
  rule: string;
  /** Número de regla según la especificación, de 1 a 6. */
  ruleNumber: number;
  /** `true` cuando ni la IA ni el score pueden moverlo hacia abajo. */
  locked: boolean;
};

/**
 * Evalúa las seis reglas en orden. La primera que se cumple manda: están
 * ordenadas de mayor a menor gravedad a propósito, así que evaluar en orden y
 * detenerse es lo correcto.
 */
export function safetyFloor(input: SafetyInput): SafetyResult {
  if (input.afectaSeguridad) {
    return {
      floor: "critica",
      rule: "Afectación de seguridad de personas o del proceso",
      ruleNumber: 1,
      locked: true,
    };
  }

  if (input.esSistemaDeSeguridad) {
    return {
      floor: "critica",
      rule: "Sistema de emergencia no disponible",
      ruleNumber: 2,
      locked: true,
    };
  }

  if (input.criticality === "critica" && !input.tieneRespaldo) {
    return {
      floor: "critica",
      rule: "Equipo crítico sin redundancia",
      ruleNumber: 3,
      locked: true,
    };
  }

  if (input.criticality === "critica" && input.tieneRespaldo) {
    return {
      floor: "alta",
      rule: "Equipo crítico con respaldo operativo",
      ruleNumber: 4,
      // No bloqueado: hay redundancia, así que el score puede ordenar dentro
      // de esta categoría según antigüedad, repetición y costo.
      locked: false,
    };
  }

  if (input.afectaProduccion) {
    return {
      floor: "media",
      rule: "Afectación productiva parcial",
      ruleNumber: 5,
      locked: false,
    };
  }

  return {
    floor: "baja",
    rule: "Defecto menor sin impacto operacional",
    ruleNumber: 6,
    locked: false,
  };
}

/**
 * Impone el piso sobre una categoría propuesta.
 *
 * Si la propuesta —venga del score o del modelo— es más baja que el piso,
 * gana el piso. Nunca al revés: subir siempre se permite, porque equivocarse
 * hacia arriba solo cuesta una revisión de más.
 */
export function aplicarPiso(
  propuesta: SafetyFloor,
  piso: SafetyFloor,
): SafetyFloor {
  return ORDEN[propuesta] >= ORDEN[piso] ? propuesta : piso;
}

/** `true` si la propuesta intentó degradar algo que una regla había fijado. */
export function intentoDegradar(
  propuesta: SafetyFloor,
  resultado: SafetyResult,
): boolean {
  return resultado.locked && ORDEN[propuesta] < ORDEN[resultado.floor];
}
