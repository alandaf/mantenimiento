/**
 * Glosario de la jerga de mantenimiento, en castellano llano.
 *
 * El público objetivo no es el jefe de máquinas —él ya sabe qué es el MTBF—
 * sino quien entra a mirar los números sin ser del rubro: un gerente, un
 * armador, un cliente en una demo. Si tiene que preguntar qué significa una
 * sigla, deja de mirar el tablero y empieza a desconfiar de él.
 *
 * Reglas de redacción:
 *  - Primero qué es en una frase, luego por qué importa. Nunca la fórmula sola.
 *  - Sin siglas dentro de la definición de una sigla.
 *  - Se dice explícitamente cuándo un número **no** significa lo que parece,
 *    que es donde de verdad se toman malas decisiones.
 */

export type GlossaryEntry = {
  /** Título del recuadro. */
  title: string;
  /** Explicación en lenguaje corriente. */
  body: string;
  /** Cómo se calcula, cuando ayuda a confiar en la cifra. */
  formula?: string;
};

export const GLOSSARY = {
  mttr: {
    title: "MTTR — Tiempo medio de reparación",
    body: "Cuánto se demora en promedio dejar operativo un equipo desde que se detecta la falla. Mide la capacidad de respuesta del equipo de mantenimiento: si sube, el problema está en repuestos, en la coordinación o en la falta de personal, no en las máquinas.",
    formula: "Horas totales de parada ÷ número de reparaciones",
  },
  mtbf: {
    title: "MTBF — Tiempo medio entre fallas",
    body: "Cuántas horas de trabajo aguanta un equipo, en promedio, antes de volver a fallar. Mide la salud de la máquina: si baja, el equipo se está deteriorando y conviene intervenir antes de que pare en el peor momento.",
    formula: "Horas de operación ÷ número de fallas",
  },
  disponibilidad: {
    title: "Disponibilidad",
    body: "Qué porcentaje del tiempo el equipo estuvo listo para trabajar. Es el número que más se mira desde gerencia, pero por sí solo engaña: una máquina que falla poco y se repara lento puede dar el mismo porcentaje que una que falla mucho y se repara rápido. Por eso se lee junto al tiempo entre fallas y al de reparación.",
    formula: "Tiempo entre fallas ÷ (tiempo entre fallas + tiempo de reparación)",
  },
  cumplimiento_pmp: {
    title: "Cumplimiento del plan preventivo",
    body: "De todas las mantenciones programadas del periodo, cuántas se hicieron de verdad. Es el mejor indicador temprano que existe: cuando este número cae, las fallas imprevistas suben unos meses después, no de inmediato. Por eso una caída aquí se paga más adelante.",
    formula: "Rutinas ejecutadas ÷ rutinas programadas",
  },
  trabajo_reactivo: {
    title: "Trabajo reactivo",
    body: "Qué proporción del trabajo fue apagar incendios en vez de mantención planificada. Bajo 30% se considera una operación bajo control; sobre 50% el equipo vive corriendo detrás de las fallas y el costo se dispara, porque reparar de urgencia siempre sale más caro.",
    formula: "Órdenes correctivas ÷ total de órdenes",
  },
  backlog: {
    title: "Backlog",
    body: "Trabajo pendiente acumulado: órdenes abiertas que aún no se ejecutan. Un poco de backlog es normal y sano. Lo preocupante es que crezca mes a mes, o que contenga equipos críticos esperando hace semanas.",
  },
  ot: {
    title: "Orden de trabajo (OT)",
    body: "El registro de un trabajo de mantenimiento: qué equipo, qué le pasó, quién lo atendió, cuánto demoró y cuánto costó. Es la unidad básica de todo el sistema — los indicadores no son más que la suma de estas órdenes.",
  },
  criticidad: {
    title: "Criticidad",
    body: "Cuánto daña a la operación que ese equipo se detenga. A es crítico —su parada detiene la producción o compromete la seguridad—, B es importante pero tiene respaldo, C es de apoyo. No mide qué tan caro es el equipo, sino qué tanto duele perderlo.",
  },
  correctivo: {
    title: "Mantenimiento correctivo",
    body: "Se repara después de que la falla ocurrió. Es el más caro: incluye la parada no planificada, el sobrecosto de urgencia y, a veces, el daño a otros componentes.",
  },
  preventivo: {
    title: "Mantenimiento preventivo",
    body: "Se interviene antes de que falle, según calendario u horas de uso. Cuesta menos que reparar de urgencia, pero solo si se ejecuta: un plan preventivo en el papel y sin cumplir no previene nada.",
  },
  predictivo: {
    title: "Mantenimiento predictivo",
    body: "Se mide el estado del equipo —vibración, temperatura, aceite— y se interviene cuando los datos anuncian la falla, no antes ni después. Es el más eficiente y el que más instrumentación exige.",
  },
  horometro: {
    title: "Horómetro",
    body: "Contador de horas de funcionamiento del equipo, como el cuentakilómetros de un auto. Es lo que permite programar por uso real en vez de por calendario: un motor que trabajó el doble necesita su mantención antes, aunque el mes sea el mismo.",
  },
  pareto: {
    title: "Análisis de Pareto",
    body: "Ordena los tipos de falla por el daño que causan y muestra cuáles concentran el 80% del impacto. Casi siempre son dos o tres: atacar esos rinde más que repartir el esfuerzo entre veinte problemas menores.",
  },
  causa_raiz: {
    title: "Análisis de causa raíz",
    body: "Busca por qué ocurrió realmente la falla, no solo qué se rompió. Cambiar un rodamiento quemado resuelve el síntoma; descubrir que se quema por desalineamiento evita que vuelva a pasar cada tres meses.",
  },
  score_riesgo: {
    title: "Score de riesgo",
    body: "Puntaje de 0 a 100 que ordena las órdenes abiertas por urgencia real, combinando criticidad del equipo, prioridad, antigüedad, si la falla se repite y el costo de tenerlo detenido. Se calcula con aritmética en el servidor, sin intervención de la IA: ante los mismos datos da siempre el mismo resultado.",
  },
  costo_parada: {
    title: "Costo de parada por hora",
    body: "Cuánto pierde la operación por cada hora que ese equipo está detenido: producción no realizada, personal ocioso, contratos incumplidos. Es lo que convierte una discusión técnica en una decisión de negocio.",
  },
  modo_falla: {
    title: "Modo de falla",
    body: "La forma concreta en que un equipo deja de funcionar: fuga de sello, desgaste de rodamiento, falla eléctrica. Clasificarlo permite ver que la misma avería se repite en distintos equipos, que es donde suele estar el ahorro grande.",
  },
  rutina_vencida: {
    title: "Rutina vencida",
    body: "Mantención programada cuya fecha ya pasó y todavía no se ejecuta. No significa que el equipo vaya a fallar mañana, pero cada día que sigue vencida el riesgo aumenta y la garantía del fabricante puede quedar comprometida.",
  },
  disparador: {
    title: "Disparador de la rutina",
    body: "Qué determina cuándo toca la mantención: el calendario (cada 120 días), las horas de uso (cada 1.000 horas) o lo que llegue primero. Lo tercero es lo habitual en máquinas: un equipo que trabajó el doble llega a las horas antes de que llegue la fecha, y esperar al calendario sería tarde.",
  },
  ritmo_uso: {
    title: "Ritmo de uso",
    body: "Cuántas horas al día trabaja el equipo en promedio, calculado con las lecturas recientes del contador. Es lo que permite anticipar la fecha real de la próxima mantención: si el ritmo sube, la fecha se adelanta sola.",
  },
  prioridad: {
    title: "Prioridad",
    body: "Urgencia asignada por quien reportó la falla, de 1 (urgente) a 4 (baja). Es un juicio humano y del momento; el score de riesgo la corrige con datos objetivos como la criticidad del equipo y cuánto lleva esperando.",
  },
  estado_ot: {
    title: "Estado de la orden",
    body: "Dónde está el trabajo: abierta (reportada, sin asignar), asignada (con responsable), en ejecución, pausada (esperando repuesto o ventana de detención), cerrada o anulada. Solo las cerradas cuentan para los indicadores de tiempo y costo.",
  },
  tipo_ot: {
    title: "Tipo de orden",
    body: "Correctivo es reparar lo que ya falló; preventivo es intervenir antes según plan; predictivo es actuar cuando las mediciones anuncian la falla; mejora es modificar el equipo para que deje de fallar. La proporción entre ellos dice más sobre la gestión que cualquier otro número.",
  },
  fallas_recientes: {
    title: "Fallas en 90 días",
    body: "Cuántas veces falló ese equipo en el último trimestre. Dos o más suele indicar que se está tratando el síntoma y no la causa: ahí conviene un análisis de causa raíz antes de seguir reparando.",
  },
  vida_util_restante: {
    title: "Vida útil restante",
    body: "Horas o días estimados antes de que toque la próxima intervención, proyectados según el ritmo de uso real de las últimas semanas. Si el equipo empieza a trabajar más, la fecha se adelanta sola.",
  },
} as const satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;
