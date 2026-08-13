import { describe, expect, it } from "vitest";
import { coerceDate, coerceNumber } from "./parse";
import { mapHeaders, normalizeEstado, normalizeHeader, normalizeTipo } from "./schema";

describe("coerceDate", () => {
  it("convierte el serial de Excel", () => {
    // 45000 = 2023-03-15 en el calendario de Excel
    expect(coerceDate(45000)?.toISOString().slice(0, 10)).toBe("2023-03-15");
  });

  it("acepta formato peruano día/mes/año", () => {
    expect(coerceDate("15/03/2026")?.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("no confunde día con mes en dd/mm", () => {
    // 03/04 es 3 de abril, no 4 de marzo
    expect(coerceDate("03/04/2026")?.toISOString().slice(0, 10)).toBe("2026-04-03");
  });

  it("acepta día/mes/año con hora", () => {
    expect(coerceDate("15/03/2026 14:30")?.toISOString()).toBe(
      "2026-03-15T14:30:00.000Z",
    );
  });

  it("acepta ISO", () => {
    expect(coerceDate("2026-03-15")?.toISOString().slice(0, 10)).toBe("2026-03-15");
  });

  it("pasa por un Date sin tocarlo", () => {
    const d = new Date("2026-03-15T00:00:00Z");
    expect(coerceDate(d)).toBe(d);
  });

  it("devuelve null con vacío o basura", () => {
    expect(coerceDate("")).toBeNull();
    expect(coerceDate(null)).toBeNull();
    expect(coerceDate("no es fecha")).toBeNull();
    expect(coerceDate(0)).toBeNull();
  });
});

describe("coerceNumber", () => {
  it("lee un número tal cual", () => {
    expect(coerceNumber(1234.5)).toBe(1234.5);
  });

  it("limpia el símbolo de moneda y los separadores de miles", () => {
    expect(coerceNumber("S/ 1,234.50")).toBe(1234.5);
  });

  it("interpreta el formato europeo con coma decimal", () => {
    expect(coerceNumber("1.234,50")).toBe(1234.5);
  });

  it("interpreta la coma sola como decimal", () => {
    expect(coerceNumber("12,5")).toBe(12.5);
  });

  it("acepta negativos", () => {
    expect(coerceNumber("-42")).toBe(-42);
  });

  it("devuelve null con vacío o texto", () => {
    expect(coerceNumber("")).toBeNull();
    expect(coerceNumber(null)).toBeNull();
    expect(coerceNumber("N/A")).toBeNull();
  });
});

describe("normalizeHeader", () => {
  it("quita tildes, mayúsculas y espacios", () => {
    expect(normalizeHeader("  Descripción Corta ")).toBe("descripcion_corta");
    expect(normalizeHeader("TAG ACTIVO")).toBe("tag_activo");
  });
});

describe("mapHeaders", () => {
  it("reconoce sinónimos habituales", () => {
    const { mapping } = mapHeaders([
      "N° OT",
      "Equipo",
      "Tipo Mantenimiento",
      "Trabajo",
      "Fecha Solicitud",
    ]);
    expect(mapping.codigo).toBe(0);
    expect(mapping.tag_activo).toBe(1);
    expect(mapping.tipo).toBe(2);
    expect(mapping.titulo).toBe(3);
    expect(mapping.reportado).toBe(4);
  });

  it("reporta las columnas que no reconoce", () => {
    const { unknown } = mapHeaders(["Equipo", "Centro de costo", "Turno"]);
    expect(unknown).toEqual(["Centro de costo", "Turno"]);
  });

  it("no mapea dos veces la misma columna", () => {
    const { mapping, unknown } = mapHeaders(["Equipo", "Activo"]);
    expect(mapping.tag_activo).toBe(0);
    expect(unknown).toEqual(["Activo"]);
  });
});

describe("normalizeTipo / normalizeEstado", () => {
  it("acepta género y plural de uso común", () => {
    expect(normalizeTipo("Correctiva")).toBe("correctivo");
    expect(normalizeTipo("PREVENTIVO")).toBe("preventivo");
  });

  it("mapea estados que la gente escribe distinto", () => {
    expect(normalizeEstado("En Proceso")).toBe("ejecucion");
    expect(normalizeEstado("Finalizada")).toBe("cerrada");
    expect(normalizeEstado("Pendiente")).toBe("abierta");
  });

  it("deja pasar lo desconocido para que Zod lo rechace con mensaje", () => {
    expect(normalizeTipo("urgente")).toBe("urgente");
  });
});
