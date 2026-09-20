import { describe, expect, it } from "vitest";
import { exigeSegundaFirma, puedeAprobar, type EntradaAprobacion } from "./approval";

const base: EntradaAprobacion = {
  estado: "cerrada",
  yaAprobada: false,
  criticidad: "media",
  esSistemaDeSeguridad: false,
  correoEjecutor: "tecnico@planta.cl",
  correoAprobador: "jefe@planta.cl",
};

describe("exigeSegundaFirma", () => {
  it("la exige en equipos críticos", () => {
    expect(exigeSegundaFirma("critica", false)).toBe(true);
  });

  it("la exige en sistemas de seguridad aunque no sean críticos", () => {
    expect(exigeSegundaFirma("alta", true)).toBe(true);
    expect(exigeSegundaFirma("baja", true)).toBe(true);
  });

  it("no la exige en el resto", () => {
    // Pedir doble firma para cambiar un filtro convierte el control en un
    // trámite que la gente aprende a saltarse.
    expect(exigeSegundaFirma("alta", false)).toBe(false);
    expect(exigeSegundaFirma("media", false)).toBe(false);
  });
});

describe("puedeAprobar", () => {
  it("no se aprueba lo que no está cerrado", () => {
    const r = puedeAprobar({ ...base, estado: "ejecucion" });
    expect(r.puede).toBe(false);
  });

  it("no se aprueba dos veces", () => {
    const r = puedeAprobar({ ...base, yaAprobada: true });
    expect(r.puede).toBe(false);
  });

  it("el ejecutor NO puede aprobar su propio trabajo en un equipo crítico", () => {
    const r = puedeAprobar({
      ...base,
      criticidad: "critica",
      correoEjecutor: "tecnico@planta.cl",
      correoAprobador: "tecnico@planta.cl",
    });
    expect(r.puede).toBe(false);
    if (!r.puede) expect(r.motivo).toContain("ejecutaste tú");
  });

  it("tampoco en un sistema de seguridad, aunque no sea crítico", () => {
    const r = puedeAprobar({
      ...base,
      criticidad: "media",
      esSistemaDeSeguridad: true,
      correoEjecutor: "tecnico@planta.cl",
      correoAprobador: "tecnico@planta.cl",
    });
    expect(r.puede).toBe(false);
  });

  it("la comparación de correos ignora mayúsculas y espacios", () => {
    // La ficha de dotación y la cuenta de acceso las escriben personas
    // distintas en momentos distintos.
    const r = puedeAprobar({
      ...base,
      criticidad: "critica",
      correoEjecutor: "  Tecnico@Planta.CL ",
      correoAprobador: "tecnico@planta.cl",
    });
    expect(r.puede).toBe(false);
  });

  it("otra persona sí puede aprobar el mismo trabajo crítico", () => {
    const r = puedeAprobar({ ...base, criticidad: "critica" });
    expect(r.puede).toBe(true);
  });

  it("en un equipo no crítico el ejecutor puede cerrar y aprobar", () => {
    const r = puedeAprobar({
      ...base,
      criticidad: "media",
      correoEjecutor: "tecnico@planta.cl",
      correoAprobador: "tecnico@planta.cl",
    });
    expect(r.puede).toBe(true);
  });

  it("una orden sin responsable asignado se puede aprobar", () => {
    // No hay ejecutor contra quien comparar; bloquearla dejaría trabajo
    // cerrado sin forma de aprobarse nunca.
    const r = puedeAprobar({
      ...base,
      criticidad: "critica",
      correoEjecutor: null,
    });
    expect(r.puede).toBe(true);
  });
});
