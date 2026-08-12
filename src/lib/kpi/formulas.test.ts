import { describe, expect, it } from "vitest";
import {
  correctiveRatio,
  inherentAvailability,
  mtbf,
  mttr,
  operationalAvailability,
  pareto,
  pmCompliance,
  toPercent,
} from "./formulas";

describe("mttr", () => {
  it("promedia las horas de reparación", () => {
    expect(mttr(21, 5)).toBe(4.2);
  });

  it("devuelve null sin correctivas, no 0", () => {
    expect(mttr(0, 0)).toBeNull();
  });
});

describe("mtbf", () => {
  it("divide horas operativas entre fallas", () => {
    expect(mtbf(2560, 10)).toBe(256);
  });

  it("devuelve null sin fallas registradas", () => {
    expect(mtbf(720, 0)).toBeNull();
  });

  it("rechaza horas operativas negativas", () => {
    expect(() => mtbf(-1, 3)).toThrow(RangeError);
  });
});

describe("inherentAvailability", () => {
  it("aplica MTBF / (MTBF + MTTR)", () => {
    expect(inherentAvailability(256, 4.2)).toBeCloseTo(0.98386, 5);
  });

  it("es 100% cuando no hubo fallas ni reparaciones", () => {
    expect(inherentAvailability(null, null)).toBe(1);
  });

  it("es 100% si hay tiempo operativo pero MTTR desconocido", () => {
    expect(inherentAvailability(500, null)).toBe(1);
  });
});

describe("operationalAvailability", () => {
  it("descuenta la parada real del calendario", () => {
    expect(operationalAvailability(720, 54.72)).toBeCloseTo(0.924, 3);
  });

  it("nunca baja de 0 aunque la parada exceda el calendario", () => {
    expect(operationalAvailability(100, 250)).toBe(0);
  });

  it("devuelve null si el periodo es vacío", () => {
    expect(operationalAvailability(0, 0)).toBeNull();
  });
});

describe("pmCompliance", () => {
  it("calcula la fracción ejecutada a tiempo", () => {
    expect(pmCompliance(17, 20)).toBe(0.85);
  });

  it("se satura en 100% si se ejecutó de más", () => {
    expect(pmCompliance(25, 20)).toBe(1);
  });
});

describe("correctiveRatio", () => {
  it("mide qué tan reactivo es el mantenimiento", () => {
    expect(correctiveRatio(30, 100)).toBe(0.3);
  });
});

describe("pareto", () => {
  const items = [
    { label: "Rodamiento", value: 50 },
    { label: "Sello", value: 25 },
    { label: "Sensor", value: 15 },
    { label: "Cableado", value: 10 },
  ];

  it("ordena descendente y acumula hasta 100%", () => {
    const result = pareto(items);
    expect(result.map((r) => r.label)).toEqual([
      "Rodamiento",
      "Sello",
      "Sensor",
      "Cableado",
    ]);
    expect(result.at(-1)!.cumulative).toBeCloseTo(100, 5);
  });

  it("marca como vitales los que llegan al 80% acumulado, incluido el que lo cruza", () => {
    const result = pareto(items);
    expect(result.filter((r) => r.isVital).map((r) => r.label)).toEqual([
      "Rodamiento",
      "Sello",
      "Sensor",
    ]);
  });

  it("no divide por cero con todo en cero", () => {
    const result = pareto([{ label: "a", value: 0 }]);
    expect(result[0].percentage).toBe(0);
    expect(result[0].isVital).toBe(false);
  });
});

describe("toPercent", () => {
  it("muestra guion cuando el KPI no es calculable", () => {
    expect(toPercent(null)).toBe("—");
  });

  it("formatea con un decimal", () => {
    expect(toPercent(0.9241)).toBe("92.4%");
  });
});
