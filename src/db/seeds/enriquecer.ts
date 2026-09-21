/**
 * Relleno del histórico: diagnóstico, mediciones, materiales, aprobaciones e
 * historial de cambios.
 *
 * Existe porque una demostración se explora sin guion. Si quien la mira abre
 * una orden cualquiera y encuentra el panel de mediciones vacío, el de
 * materiales vacío y el historial vacío, concluye —con razón— que esas partes
 * no están hechas. Da igual que tres órdenes escogidas se vean perfectas.
 *
 * El relleno no inventa precisión: los textos se derivan del modo de falla que
 * ya tiene la orden, y las mediciones solo se añaden a equipos donde medir
 * vibración y temperatura tiene sentido. Una válvula no vibra.
 */

type Categoria =
  | "mecanica"
  | "electrica"
  | "instrumentacion"
  | "hidraulica"
  | "neumatica"
  | "operacional"
  | "estructural";

/**
 * Qué se encontró y qué se hizo, por familia de falla.
 *
 * Se deriva de la categoría y no del modo concreto porque inventar una causa
 * distinta para cada uno de los 41 modos produciría texto plausible pero
 * arbitrario. Por familia el texto es genérico y honesto.
 */
const DIAGNOSTICO: Record<
  Categoria,
  { causas: string[]; acciones: string[] }
> = {
  mecanica: {
    causas: [
      "Desgaste normal del componente por horas de servicio.",
      "Rodamiento con degradación en pista externa.",
      "Sello con pérdida de elasticidad por temperatura de trabajo.",
      "Holgura fuera de tolerancia en el acople.",
    ],
    acciones: [
      "Componente reemplazado y verificado en marcha.",
      "Rodamiento reemplazado y lubricación repuesta.",
      "Sello reemplazado. Se verificó estanqueidad.",
      "Ajuste y alineación verificados con reloj comparador.",
    ],
  },
  electrica: {
    causas: [
      "Conexión con apriete deficiente en borne de potencia.",
      "Aislación degradada en tramo de cable.",
      "Protección actuada por sobrecarga sostenida.",
      "Contactor con contactos erosionados.",
    ],
    acciones: [
      "Reapriete de bornes y termografía de verificación.",
      "Tramo de cable reemplazado y aislación medida.",
      "Protección repuesta tras verificar la carga.",
      "Contactor reemplazado.",
    ],
  },
  instrumentacion: {
    causas: [
      "Instrumento fuera de calibración respecto al patrón.",
      "Conexionado de señal con falso contacto.",
      "Configuración de rango distinta a la de ingeniería.",
      "Elemento sensor con suciedad de proceso.",
    ],
    acciones: [
      "Recalibración contra patrón trazable. Certificado archivado.",
      "Conexionado rehecho y señal verificada en el sistema.",
      "Rango reconfigurado según hoja de datos.",
      "Elemento limpiado y verificado en línea.",
    ],
  },
  hidraulica: {
    causas: [
      "Fuga por conexión con apriete deficiente.",
      "Manguera con envejecimiento y fisura superficial.",
      "Aceite con contaminación por sobre el grado admisible.",
    ],
    acciones: [
      "Conexión rehecha y presión de prueba verificada.",
      "Manguera reemplazada.",
      "Aceite reemplazado y filtro cambiado.",
    ],
  },
  neumatica: {
    causas: [
      "Fuga en unión roscada de la línea de aire.",
      "Filtro coalescente saturado.",
      "Purga automática sin operar.",
    ],
    acciones: [
      "Unión rehecha y fuga verificada con solución jabonosa.",
      "Filtro reemplazado.",
      "Purga reparada y ciclo verificado.",
    ],
  },
  operacional: {
    causas: [
      "Condición de proceso fuera del rango habitual de operación.",
      "Acumulación por falta de limpieza en la frecuencia prevista.",
      "Maniobra ejecutada fuera de secuencia.",
    ],
    acciones: [
      "Parámetros de operación normalizados con sala de control.",
      "Limpieza ejecutada y frecuencia revisada con planificación.",
      "Secuencia repasada con el turno. Sin daño al equipo.",
    ],
  },
  estructural: {
    causas: [
      "Corrosión superficial en zona de difícil acceso.",
      "Fisura incipiente detectada en inspección.",
      "Deterioro de recubrimiento protector.",
    ],
    acciones: [
      "Zona tratada y recubrimiento repuesto.",
      "Reparación estructural ejecutada y verificada.",
      "Recubrimiento repuesto según especificación.",
    ],
  },
};

/** Repuestos típicos por familia, para el detalle de materiales. */
const REPUESTOS: Record<Categoria, string[]> = {
  mecanica: ["Rodamiento", "Sello mecánico", "Retén", "Acople elástico", "Empaquetadura"],
  electrica: ["Contactor", "Cable de potencia", "Relé térmico", "Borne", "Fusible"],
  instrumentacion: ["Transmisor", "Cable de señal", "Sensor", "Manómetro"],
  hidraulica: ["Manguera hidráulica", "Aceite hidráulico", "Filtro de aceite", "Conector"],
  neumatica: ["Filtro coalescente", "Válvula de purga", "Manguera de aire", "Racor"],
  operacional: ["Elemento filtrante", "Lubricante", "Material de limpieza"],
  estructural: ["Pintura epóxica", "Plancha de refuerzo", "Ánodo de sacrificio"],
};

/** Equipos donde medir vibración y temperatura tiene sentido. */
const ROTATIVOS = new Set([
  "bomba",
  "motor",
  "compresor",
  "transportador",
  "generador",
  "maquina",
]);

export function esRotativo(assetType: string): boolean {
  return ROTATIVOS.has(assetType);
}

export function diagnosticoPara(
  categoria: string,
  modoNombre: string,
  activoNombre: string,
  elegir: <T>(xs: readonly T[]) => T,
): { symptom: string; causeFound: string; actionPerformed: string } {
  const tabla = DIAGNOSTICO[categoria as Categoria] ?? DIAGNOSTICO.mecanica;
  return {
    symptom: `${modoNombre} detectado en ${activoNombre} durante la ronda de turno.`,
    causeFound: elegir(tabla.causas),
    actionPerformed: elegir(tabla.acciones),
  };
}

export function repuestoPara(
  categoria: string,
  elegir: <T>(xs: readonly T[]) => T,
): string {
  return elegir(REPUESTOS[categoria as Categoria] ?? REPUESTOS.mecanica);
}
