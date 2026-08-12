import { describe, expect, it } from "vitest";
import { RISK_WEIGHTS, riskBand, riskScore } from "./risk";

const base = {
  criticality: "C" as const,
  priority: 4,
  ageDays: 0,
  repeatFailures90d: 0,
  downtimeCostPerHour: 0,
};

describe("riskScore", () => {
  it("suma los cinco factores", () => {
    const { score, factors } = riskScore({
      criticality: "A",
      priority: 1,
      ageDays: 5,
      repeatFailures90d: 2,
      downtimeCostPerHour: 1500,
    });
    expect(factors).toEqual({
      criticality: 30,
      priority: 25,
      age: 6,
      repeat: 10,
      cost: 6,
    });
    expect(score).toBe(77);
  });

  it("da el mínimo a una OT trivial y reciente", () => {
    expect(riskScore(base).score).toBe(8);
  });

  it("satura la antigüedad en su tope", () => {
    const { factors } = riskScore({ ...base, ageDays: 365 });
    expect(factors.age).toBe(RISK_WEIGHTS.ageMax);
  });

  it("satura la repetición de fallas en su tope", () => {
    const { factors } = riskScore({ ...base, repeatFailures90d: 20 });
    expect(factors.repeat).toBe(RISK_WEIGHTS.repeatMax);
  });

  it("satura el factor económico en su tope", () => {
    const { factors } = riskScore({ ...base, downtimeCostPerHour: 99_999 });
    expect(factors.cost).toBe(RISK_WEIGHTS.costMax);
  });

  it("no penaliza con fechas futuras ni valores negativos", () => {
    const { factors } = riskScore({
      ...base,
      ageDays: -30,
      repeatFailures90d: -5,
      downtimeCostPerHour: -100,
    });
    expect(factors.age).toBe(0);
    expect(factors.repeat).toBe(0);
    expect(factors.cost).toBe(0);
  });

  it("trata una prioridad fuera de rango como media, sin romperse", () => {
    expect(riskScore({ ...base, priority: 99 }).factors.priority).toBe(
      RISK_WEIGHTS.priority[3],
    );
  });

  it("nunca supera 100", () => {
    const { score } = riskScore({
      criticality: "A",
      priority: 1,
      ageDays: 999,
      repeatFailures90d: 99,
      downtimeCostPerHour: 99_999,
    });
    expect(score).toBeLessThanOrEqual(100);
  });

  it("ordena correctamente dos OT comparables", () => {
    const criticoViejo = riskScore({
      criticality: "A",
      priority: 2,
      ageDays: 10,
      repeatFailures90d: 1,
      downtimeCostPerHour: 2400,
    }).score;
    const menorReciente = riskScore({
      criticality: "C",
      priority: 3,
      ageDays: 1,
      repeatFailures90d: 0,
      downtimeCostPerHour: 350,
    }).score;
    expect(criticoViejo).toBeGreaterThan(menorReciente);
  });
});

describe("riskBand", () => {
  it("mapea el score a su banda de acción", () => {
    expect(riskBand(85)).toBe("critica");
    expect(riskBand(70)).toBe("critica");
    expect(riskBand(55)).toBe("alta");
    expect(riskBand(35)).toBe("media");
    expect(riskBand(12)).toBe("baja");
  });
});
