import { describe, expect, it } from "vitest";
import {
  advancePlan,
  latestReading,
  pmStatus,
  projectDate,
  runRatePerDay,
} from "./meters";

const origin = Date.UTC(2026, 0, 1);
const at = (days: number) => new Date(origin + days * 86_400_000);
const NOW = at(100);

describe("runRatePerDay", () => {
  it("calcula horas de marcha por día", () => {
    // 1200 h en 100 días = 12 h/día: un buque que navega la mitad del tiempo
    const rate = runRatePerDay([
      { hours: 10_000, takenAt: at(0) },
      { hours: 11_200, takenAt: at(100) },
    ]);
    expect(rate).toBe(12);
  });

  it("usa solo la ventana reciente y no toda la historia", () => {
    // El equipo estuvo parado el primer año y ahora navega 20 h/día.
    const rate = runRatePerDay(
      [
        { hours: 5_000, takenAt: at(-400) },
        { hours: 5_000, takenAt: at(0) },
        { hours: 5_600, takenAt: at(30) },
      ],
      90,
    );
    expect(rate).toBe(20);
  });

  it("devuelve null con una sola lectura", () => {
    expect(runRatePerDay([{ hours: 100, takenAt: at(0) }])).toBeNull();
  });

  it("devuelve null si las lecturas están a menos de un día", () => {
    expect(
      runRatePerDay([
        { hours: 100, takenAt: at(0) },
        { hours: 108, takenAt: at(0.5) },
      ]),
    ).toBeNull();
  });

  it("rechaza un horómetro que retrocede en vez de proyectar sobre él", () => {
    expect(
      runRatePerDay([
        { hours: 9_000, takenAt: at(0) },
        { hours: 120, takenAt: at(30) },
      ]),
    ).toBeNull();
  });

  it("rechaza un ritmo físicamente imposible", () => {
    expect(
      runRatePerDay([
        { hours: 0, takenAt: at(0) },
        { hours: 2_400, takenAt: at(10) }, // 240 h/día
      ]),
    ).toBeNull();
  });

  it("acepta un equipo detenido: ritmo cero es un dato válido", () => {
    expect(
      runRatePerDay([
        { hours: 5_000, takenAt: at(0) },
        { hours: 5_000, takenAt: at(60) },
      ]),
    ).toBe(0);
  });
});

describe("latestReading", () => {
  it("devuelve la más reciente sin depender del orden de entrada", () => {
    const r = latestReading([
      { hours: 100, takenAt: at(5) },
      { hours: 300, takenAt: at(20) },
      { hours: 200, takenAt: at(12) },
    ]);
    expect(r?.hours).toBe(300);
  });

  it("devuelve null sin lecturas", () => {
    expect(latestReading([])).toBeNull();
  });
});

describe("projectDate", () => {
  it("proyecta la fecha en que se alcanzarán las horas objetivo", () => {
    // Faltan 240 h a 12 h/día = 20 días
    const d = projectDate(11_200, 11_440, 12, NOW)!;
    expect(Math.round((d.getTime() - NOW.getTime()) / 86_400_000)).toBe(20);
  });

  it("un equipo detenido no vence nunca por horas", () => {
    expect(projectDate(100, 500, 0, NOW)).toBeNull();
  });

  it("sin ritmo conocido no proyecta", () => {
    expect(projectDate(100, 500, null, NOW)).toBeNull();
  });

  it("si ya se pasó, la fecha es ahora", () => {
    expect(projectDate(600, 500, 12, NOW)).toEqual(NOW);
  });
});

describe("pmStatus", () => {
  it("proyecta una fecha para una rutina por horas", () => {
    const s = pmStatus(
      { trigger: "horas", nextDueAt: null, nextDueHours: 11_500 },
      11_200,
      12,
      NOW,
    );
    expect(s.overdue).toBe(false);
    expect(s.drivenBy).toBe("horas");
    expect(s.remainingHours).toBe(300);
    expect(s.remainingDays).toBe(25);
  });

  it("marca vencida por horas aunque no haya ritmo conocido", () => {
    const s = pmStatus(
      { trigger: "horas", nextDueAt: null, nextDueHours: 11_000 },
      11_200,
      null,
      NOW,
    );
    expect(s.overdue).toBe(true);
    expect(s.drivenBy).toBe("horas");
    expect(s.remainingHours).toBe(-200);
  });

  it("con ambos disparadores manda el que vence primero", () => {
    // Horas: faltan 120 h a 12 h/día = 10 días. Calendario: 40 días.
    const s = pmStatus(
      { trigger: "ambos", nextDueAt: at(140), nextDueHours: 11_320 },
      11_200,
      12,
      NOW,
    );
    expect(s.drivenBy).toBe("horas");
    expect(s.remainingDays).toBe(10);
  });

  it("con ambos disparadores el calendario manda si llega antes", () => {
    // Horas: faltan 1200 h a 12 h/día = 100 días. Calendario: 15 días.
    const s = pmStatus(
      { trigger: "ambos", nextDueAt: at(115), nextDueHours: 12_400 },
      11_200,
      12,
      NOW,
    );
    expect(s.drivenBy).toBe("calendario");
    expect(s.remainingDays).toBe(15);
  });

  it("una rutina por horas en equipo detenido no vence, pero informa cuánto falta", () => {
    const s = pmStatus(
      { trigger: "horas", nextDueAt: null, nextDueHours: 11_500 },
      11_200,
      0,
      NOW,
    );
    expect(s.overdue).toBe(false);
    expect(s.remainingHours).toBe(300);
    expect(s.dueDate).toBeNull();
    expect(s.remainingDays).toBeNull();
  });

  it("ignora las horas si la rutina es solo por calendario", () => {
    const s = pmStatus(
      { trigger: "calendario", nextDueAt: at(110), nextDueHours: 100 },
      99_999,
      12,
      NOW,
    );
    expect(s.drivenBy).toBe("calendario");
    expect(s.remainingHours).toBeNull();
    expect(s.overdue).toBe(false);
  });

  it("una rutina por horas sin lectura de horómetro no puede evaluarse", () => {
    const s = pmStatus(
      { trigger: "horas", nextDueAt: null, nextDueHours: 500 },
      null,
      12,
      NOW,
    );
    expect(s.overdue).toBe(false);
    expect(s.remainingHours).toBeNull();
    expect(s.drivenBy).toBeNull();
  });

  it("detecta vencida por calendario", () => {
    const s = pmStatus(
      { trigger: "calendario", nextDueAt: at(80), nextDueHours: null },
      null,
      null,
      NOW,
    );
    expect(s.overdue).toBe(true);
    expect(s.remainingDays).toBe(-20);
  });
});

describe("advancePlan", () => {
  it("avanza la cadencia por horas desde la lectura de ejecución", () => {
    const next = advancePlan(
      { trigger: "horas", frequencyDays: null, frequencyHours: 500 },
      NOW,
      11_240,
    );
    expect(next.nextDueHours).toBe(11_740);
    expect(next.nextDueAt).toBeNull();
  });

  it("avanza ambas cadencias cuando el disparador es mixto", () => {
    const next = advancePlan(
      { trigger: "ambos", frequencyDays: 180, frequencyHours: 2_000 },
      NOW,
      11_240,
    );
    expect(next.nextDueHours).toBe(13_240);
    expect(
      Math.round((next.nextDueAt!.getTime() - NOW.getTime()) / 86_400_000),
    ).toBe(180);
  });

  it("no puede avanzar por horas sin lectura de ejecución", () => {
    const next = advancePlan(
      { trigger: "horas", frequencyDays: null, frequencyHours: 500 },
      NOW,
      null,
    );
    expect(next.nextDueHours).toBeNull();
  });
});
