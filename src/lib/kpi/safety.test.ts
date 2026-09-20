import { describe, expect, it } from "vitest";
import {
  aplicarPiso,
  intentoDegradar,
  safetyFloor,
  type SafetyInput,
} from "./safety";

const base: SafetyInput = {
  esSistemaDeSeguridad: false,
  afectaSeguridad: false,
  criticality: "media",
  tieneRespaldo: false,
  afectaProduccion: false,
};

describe("safetyFloor", () => {
  it("la afectación de seguridad manda sobre todo lo demás", () => {
    const r = safetyFloor({
      ...base,
      afectaSeguridad: true,
      criticality: "baja",
      tieneRespaldo: true,
      afectaProduccion: false,
    });
    // Aunque el activo sea de baja criticidad, tenga respaldo y no afecte
    // producción: si hay riesgo para personas, es crítica y punto.
    expect(r.floor).toBe("critica");
    expect(r.ruleNumber).toBe(1);
    expect(r.locked).toBe(true);
  });

  it("un sistema de seguridad fuera de servicio es crítico aunque nada más lo sea", () => {
    const r = safetyFloor({ ...base, esSistemaDeSeguridad: true, criticality: "baja" });
    expect(r.floor).toBe("critica");
    expect(r.ruleNumber).toBe(2);
    expect(r.locked).toBe(true);
  });

  it("equipo crítico sin redundancia queda bloqueado en crítica", () => {
    const r = safetyFloor({ ...base, criticality: "critica", tieneRespaldo: false });
    expect(r.floor).toBe("critica");
    expect(r.locked).toBe(true);
  });

  it("equipo crítico CON respaldo baja a alta y admite reordenamiento", () => {
    const r = safetyFloor({ ...base, criticality: "critica", tieneRespaldo: true });
    expect(r.floor).toBe("alta");
    // Hay redundancia: el score puede ordenar dentro de la categoría.
    expect(r.locked).toBe(false);
  });

  it("afectación productiva sin riesgo de seguridad es media", () => {
    const r = safetyFloor({ ...base, afectaProduccion: true });
    expect(r.floor).toBe("media");
    expect(r.ruleNumber).toBe(5);
  });

  it("un defecto menor cae en baja", () => {
    expect(safetyFloor(base).floor).toBe("baja");
  });

  it("las reglas se evalúan en orden: seguridad antes que redundancia", () => {
    // Equipo crítico CON respaldo, pero la falla afecta la seguridad.
    // Si se evaluara la redundancia primero daría "alta"; debe dar "crítica".
    const r = safetyFloor({
      ...base,
      criticality: "critica",
      tieneRespaldo: true,
      afectaSeguridad: true,
    });
    expect(r.floor).toBe("critica");
    expect(r.ruleNumber).toBe(1);
  });
});

describe("aplicarPiso", () => {
  it("sube una propuesta que queda por debajo del piso", () => {
    expect(aplicarPiso("baja", "critica")).toBe("critica");
  });

  it("respeta una propuesta que ya está por encima", () => {
    expect(aplicarPiso("critica", "media")).toBe("critica");
  });

  it("deja igual lo que coincide", () => {
    expect(aplicarPiso("alta", "alta")).toBe("alta");
  });
});

describe("intentoDegradar", () => {
  it("detecta que se quiso bajar una prioridad bloqueada", () => {
    const r = safetyFloor({ ...base, esSistemaDeSeguridad: true });
    // Esto es exactamente lo que no puede pasar: el modelo proponiendo
    // "media" para un detector de gas fuera de servicio.
    expect(intentoDegradar("media", r)).toBe(true);
  });

  it("no marca nada cuando la categoría no estaba bloqueada", () => {
    const r = safetyFloor({ ...base, afectaProduccion: true });
    expect(intentoDegradar("baja", r)).toBe(false);
  });

  it("no marca nada cuando la propuesta sube", () => {
    const r = safetyFloor({ ...base, esSistemaDeSeguridad: true });
    expect(intentoDegradar("critica", r)).toBe(false);
  });
});
