import { describe, expect, it } from "vitest";
import {
  chronicityBand,
  intervalsInDays,
  meanIntervalDays,
  nextExpectedFailure,
  recurrencePriority,
  recurrenceTrend,
} from "./recurrence";

/** Construye fechas a partir de días transcurridos desde un origen fijo. */
const origin = Date.UTC(2026, 0, 1);
const days = (...offsets: number[]) =>
  offsets.map((d) => new Date(origin + d * 86_400_000));

describe("intervalsInDays", () => {
  it("calcula los intervalos entre eventos consecutivos", () => {
    expect(intervalsInDays(days(0, 30, 75))).toEqual([30, 45]);
  });

  it("ordena cronológicamente antes de medir", () => {
    expect(intervalsInDays(days(75, 0, 30))).toEqual([30, 45]);
  });

  it("no hay intervalos con menos de dos eventos", () => {
    expect(intervalsInDays(days(0))).toEqual([]);
    expect(intervalsInDays([])).toEqual([]);
  });
});

describe("meanIntervalDays", () => {
  it("promedia los intervalos", () => {
    expect(meanIntervalDays(days(0, 30, 75))).toBe(37.5);
  });

  it("devuelve null con un solo evento", () => {
    expect(meanIntervalDays(days(0))).toBeNull();
  });
});

describe("recurrenceTrend", () => {
  it("detecta aceleración cuando los intervalos se acortan", () => {
    // 90, 60, 40, 25 días entre fallas
    expect(recurrenceTrend(days(0, 90, 150, 190, 215))).toBe("acelerando");
  });

  it("detecta desaceleración cuando se alargan", () => {
    expect(recurrenceTrend(days(0, 25, 65, 125, 215))).toBe("desacelerando");
  });

  it("reconoce una cadencia estable", () => {
    expect(recurrenceTrend(days(0, 30, 60, 90, 120))).toBe("estable");
  });

  it("no inventa tendencia con menos de cuatro eventos", () => {
    expect(recurrenceTrend(days(0, 30, 45))).toBe("indeterminada");
    expect(recurrenceTrend(days(0, 30))).toBe("indeterminada");
    expect(recurrenceTrend([])).toBe("indeterminada");
  });
});

describe("nextExpectedFailure", () => {
  it("proyecta el intervalo medio desde la última falla", () => {
    // Última falla el día 75 (17-mar) + intervalo medio de 37.5 días.
    const next = nextExpectedFailure(days(0, 30, 75))!;
    expect(next.toISOString().slice(0, 10)).toBe("2026-04-23");
  });

  it("devuelve null si no hay serie suficiente", () => {
    expect(nextExpectedFailure(days(0))).toBeNull();
  });
});

describe("chronicityBand", () => {
  it("marca como crónica la falla muy frecuente", () => {
    expect(chronicityBand(4, 2)).toBe("cronica");
  });

  it("marca como crónica la menos frecuente pero muy costosa", () => {
    expect(chronicityBand(3, 30)).toBe("cronica");
  });

  it("distingue la recurrente de la crónica por impacto", () => {
    expect(chronicityBand(3, 5)).toBe("recurrente");
    expect(chronicityBand(2, 100)).toBe("recurrente");
  });

  it("una sola ocurrencia no es un patrón", () => {
    expect(chronicityBand(1, 50)).toBe("aislada");
  });
});

describe("recurrencePriority", () => {
  it("combina frecuencia, impacto, criticidad y tendencia", () => {
    expect(
      recurrencePriority({
        occurrences: 3,
        downtimeHours: 10,
        trend: "acelerando",
        criticality: "A",
      }),
    ).toBe(68); // 21 + 12 + 25 + 10
  });

  it("penaliza menos un patrón estable que uno acelerando", () => {
    const base = {
      occurrences: 3,
      downtimeHours: 10,
      criticality: "B" as const,
    };
    expect(
      recurrencePriority({ ...base, trend: "acelerando" }),
    ).toBeGreaterThan(recurrencePriority({ ...base, trend: "estable" }));
  });

  it("satura cada factor y nunca supera 100", () => {
    expect(
      recurrencePriority({
        occurrences: 99,
        downtimeHours: 9999,
        trend: "acelerando",
        criticality: "A",
      }),
    ).toBeLessThanOrEqual(100);
  });
});
