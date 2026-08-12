/**
 * Score de riesgo de una orden de trabajo abierta: 0–100.
 *
 * Es aritmética pura y auditable, no una opinión del modelo. La IA recibe este
 * número ya calculado y solo aporta lo que un cálculo no puede: interpretar el
 * contexto, detectar patrones y redactar la justificación.
 *
 * Cinco factores, con techo propio para que ninguno domine el resultado:
 */
export const RISK_WEIGHTS = {
  /** Criticidad del activo — el factor de mayor peso (matriz ABC). */
  criticality: { A: 30, B: 16, C: 6 },
  /** Prioridad declarada por quien reportó la falla. */
  priority: { 1: 25, 2: 17, 3: 8, 4: 2 },
  /** Antigüedad de la OT abierta: 1.2 puntos por día, tope 18. */
  ageMax: 18,
  agePerDay: 1.2,
  /** Fallas repetidas del activo en 90 días: 5 puntos cada una, tope 15. */
  repeatMax: 15,
  repeatPerFailure: 5,
  /** Exposición económica por hora de parada, normalizada a 12 puntos. */
  costMax: 12,
  /** Costo/hora que satura el factor económico (S/). */
  costCeiling: 3000,
} as const;

export type RiskInput = {
  criticality: "A" | "B" | "C";
  /** 1 = urgente … 4 = baja */
  priority: number;
  /** Días transcurridos desde el reporte */
  ageDays: number;
  /** Correctivas del mismo activo en los últimos 90 días */
  repeatFailures90d: number;
  /** Costo de una hora de parada del activo, en soles */
  downtimeCostPerHour: number;
};

export type RiskBreakdown = {
  score: number;
  factors: {
    criticality: number;
    priority: number;
    age: number;
    repeat: number;
    cost: number;
  };
};

export function riskScore(input: RiskInput): RiskBreakdown {
  const w = RISK_WEIGHTS;

  const criticality = w.criticality[input.criticality] ?? 0;

  const priority =
    w.priority[input.priority as keyof typeof w.priority] ?? w.priority[3];

  // La antigüedad no penaliza hacia atrás: una fecha futura vale 0, no negativo.
  const age = Math.min(w.ageMax, Math.max(0, input.ageDays) * w.agePerDay);

  const repeat = Math.min(
    w.repeatMax,
    Math.max(0, input.repeatFailures90d) * w.repeatPerFailure,
  );

  const cost = Math.min(
    w.costMax,
    (Math.max(0, input.downtimeCostPerHour) / w.costCeiling) * w.costMax,
  );

  const score = criticality + priority + age + repeat + cost;

  return {
    // El máximo teórico es 100; se acota por si los pesos cambian.
    score: Math.round(Math.min(100, score) * 10) / 10,
    factors: { criticality, priority, age, repeat, cost },
  };
}

/** Banda de acción derivada del score. */
export function riskBand(score: number): "critica" | "alta" | "media" | "baja" {
  if (score >= 70) return "critica";
  if (score >= 50) return "alta";
  if (score >= 30) return "media";
  return "baja";
}
