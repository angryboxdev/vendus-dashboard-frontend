import { describe, expect, it } from "vitest";
import type { ReviewDay } from "../entities/attendance-review.ts";
import { classify, classifyDay, dayState, formatMinutes, plannedMinutesOf, weekTotals } from "./attendance-review.service.ts";

const day = (over: Partial<ReviewDay> = {}): ReviewDay => ({
  employeeId: "e1",
  date: "2026-10-27",
  planned: [{ start: "15:00", end: "23:00" }],
  punches: [
    { at: "15:00", kind: "in" },
    { at: "23:00", kind: "out" },
  ],
  workedMinutes: 480,
  plannedMinutes: 480,
  phase: "done",
  ...over,
});
const late = day({ punches: [{ at: "15:21", kind: "in" }, { at: "23:00", kind: "out" }], workedMinutes: 459 });

describe("conferência V2 — estado do dia", () => {
  it("conforme, atraso, falta, em curso, folga, futuro e sem escala são estados distintos", () => {
    expect(dayState(day())).toBe("ok");
    expect(dayState(late)).toBe("late");
    expect(dayState(day({ punches: [], workedMinutes: 0 }))).toBe("absent");
    expect(dayState(day({ phase: "in_progress", punches: [{ at: "15:21", kind: "in" }], workedMinutes: 90 }))).toBe("in_progress");
    expect(dayState(day({ planned: null, dayOff: true, punches: [], workedMinutes: 0, plannedMinutes: 0 }))).toBe("day_off");
    expect(dayState(day({ phase: "future", punches: [], workedMinutes: 0 }))).toBe("future");
    expect(dayState(day({ planned: null, plannedMinutes: 0, workedMinutes: 340 }))).toBe("no_schedule");
    expect(dayState(day({ absence: "Férias", punches: [], workedMinutes: 0 }))).toBe("justified");
  });
});

describe("conferência V2 — o que cada decisão faz", () => {
  it("6) 15:21 com escala 15:00–23:00, turno terminado: cumpriu valida 8h e a picagem original fica", () => {
    const r = classifyDay(late, "fulfilled", false);
    expect(r).toMatchObject({ bucket: "apply", before: 459, after: 480 });
    expect(late.punches[0]!.at).toBe("15:21");
  });

  it("7) o mesmo com o turno em curso: não se conclui antes do fim", () => {
    expect(classifyDay({ ...late, phase: "in_progress" }, "fulfilled", false)).toMatchObject({ bucket: "excluded", reason: "in_progress" });
  });

  it("8) atraso real: manter fica com as horas registadas", () => {
    expect(classifyDay(late, "keep", false)).toMatchObject({ bucket: "apply", before: 459, after: 459 });
  });

  it("9) sem picagens: nunca entra no lote; num só dia pede confirmação explícita", () => {
    const none = day({ punches: [], workedMinutes: 0 });
    expect(classifyDay(none, "fulfilled", true)).toMatchObject({ bucket: "individual", reason: "no_punches" });
    expect(classifyDay(none, "fulfilled", false)).toMatchObject({ bucket: "apply", after: 480 });
  });

  it("10) 13h trabalhadas não descem para as 8h previstas", () => {
    expect(classifyDay(day({ workedMinutes: 780 }), "fulfilled", false)).toMatchObject({ bucket: "excluded", reason: "overtime" });
  });

  it("11) saída em falta (noturno): no lote vai para revisão individual, sem inventar saída", () => {
    const night = day({ planned: [{ start: "22:00", end: "04:00" }], punches: [{ at: "21:58", kind: "in" }], workedMinutes: 0 });
    expect(classifyDay(night, "fulfilled", true)).toMatchObject({ bucket: "individual", reason: "single_punch" });
  });

  it("12) repartido com pausa não paga: as horas são as dos segmentos, não início→fim", () => {
    expect(plannedMinutesOf([{ start: "11:00", end: "15:00" }, { start: "19:00", end: "23:00" }])).toBe(480);
    expect(plannedMinutesOf([{ start: "09:00", end: "18:00" }], 60)).toBe(480);
    expect(plannedMinutesOf([{ start: "22:00", end: "04:00" }])).toBe(360);
  });

  it("13) folga, futuro, férias e período fechado ficam de fora", () => {
    const off = day({ planned: null, dayOff: true, punches: [], workedMinutes: 0, plannedMinutes: 0 });
    expect(classifyDay(off, "fulfilled", true).reason).toBe("day_off");
    expect(classifyDay(day({ phase: "future" }), "fulfilled", true).reason).toBe("future");
    expect(classifyDay(day({ absence: "Férias" }), "fulfilled", true).reason).toBe("absence");
    expect(classifyDay({ ...late, closed: true }, "fulfilled", false).reason).toBe("closed");
  });

  it("14) 5h40 trabalhadas com 0h teóricas: exceção de escala antes de qualquer cumprimento", () => {
    expect(classifyDay(day({ planned: null, plannedMinutes: 0, workedMinutes: 340 }), "fulfilled", false)).toMatchObject({
      bucket: "excluded",
      reason: "schedule_exception",
    });
  });

  it("20) lote misto: aptos, já conformes, excluídos e revisão individual contados à parte", () => {
    const r = classify([late, day(), day({ workedMinutes: 780 }), day({ punches: [], workedMinutes: 0 })], "fulfilled");
    expect(r.map((x) => x.bucket)).toEqual(["apply", "already", "excluded", "individual"]);
  });

  it("um dia já revisto não volta a ser corrigido (sem duplicados)", () => {
    const done = day({ review: { decision: "keep", validatedMinutes: 459, reason: "x", by: "g", scope: "day" } });
    expect(classifyDay(done, "fulfilled", false)).toMatchObject({ bucket: "already", reason: "already_reviewed" });
  });

  it("correção manual só dia a dia; ausência não gera horas", () => {
    expect(classifyDay(late, "manual", true)).toMatchObject({ bucket: "individual", reason: "batch_manual" });
    expect(classifyDay(day({ punches: [], workedMinutes: 0 }), "absence", false)).toMatchObject({ bucket: "apply", after: 0 });
  });
});

describe("conferência V2 — resumo semanal", () => {
  it("validado (conforme/revisto) separado do provisório; pendências contadas", () => {
    const t = weekTotals([day(), late, day({ phase: "future", punches: [], workedMinutes: 0 })]);
    expect(t).toEqual({ planned: 1440, validated: 480, provisional: 459, pending: 1 });
    expect(formatMinutes(-21)).toBe("−0h21");
    expect(formatMinutes(21, true)).toBe("+0h21");
  });
});
