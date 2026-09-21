import { describe, expect, it } from "vitest";
import { puedeCerrarse } from "./closure";

const paso = (sequence: number, result: string | null) => ({
  sequence,
  description: `Paso ${sequence}`,
  result,
});

describe("puedeCerrarse", () => {
  it("una orden sin pauta se cierra sin más", () => {
    // Las correctivas no llevan pauta: la regla no debe estorbarlas.
    expect(puedeCerrarse([]).puede).toBe(true);
  });

  it("no se cierra con pasos en blanco", () => {
    const r = puedeCerrarse([paso(1, "conforme"), paso(2, null)]);
    expect(r.puede).toBe(false);
    if (!r.puede) {
      expect(r.pendientes).toHaveLength(1);
      expect(r.mensaje).toContain("1 paso sin registrar");
    }
  });

  it("no conforme y no aplica SÍ permiten cerrar", () => {
    // Resuelto no es lo mismo que conforme. Lo que no se admite es el blanco.
    const r = puedeCerrarse([
      paso(1, "conforme"),
      paso(2, "no_conforme"),
      paso(3, "no_aplica"),
    ]);
    expect(r.puede).toBe(true);
  });

  it("el mensaje nombra los pasos que faltan", () => {
    const r = puedeCerrarse([paso(1, null), paso(2, null)]);
    if (!r.puede) {
      expect(r.mensaje).toContain("Paso 1");
      expect(r.mensaje).toContain("Paso 2");
    }
  });

  it("con muchos pendientes resume en vez de listarlos todos", () => {
    const r = puedeCerrarse([1, 2, 3, 4, 5, 6].map((i) => paso(i, null)));
    if (!r.puede) {
      expect(r.mensaje).toContain("6 pasos sin registrar");
      expect(r.mensaje).toContain("y 3 más");
    }
  });
});
