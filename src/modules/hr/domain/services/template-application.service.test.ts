import { describe, expect, it } from "vitest";
import type { TemplateOccurrence } from "../entities/shift-template.ts";
import { buildDecisions, canReplace, countToCreate, formatOccurrenceDate, initialChoice } from "./template-application.service.ts";

function occ(overrides: Partial<TemplateOccurrence>): TemplateOccurrence {
  return {
    key: "e1|2026-11-07",
    employeeId: "e1",
    employeeName: "Carlos Andrés",
    positionId: null,
    workDate: "2026-11-07",
    startTime: "08:00",
    endTime: "16:00",
    secondStartTime: null,
    secondEndTime: null,
    endsNextDay: false,
    locationId: "loc",
    status: "valid",
    holidayName: null,
    existingShift: null,
    existingHasAttendance: false,
    ...overrides,
  };
}

const EXISTING = { id: "s1", startTime: "09:00", endTime: "17:00", secondStartTime: null, secondEndTime: null, locationId: "loc" };

describe("template-application.service (RH 2.0)", () => {
  it("válidas criam por omissão; conflitos ficam em Manter (nunca substituição silenciosa)", () => {
    expect(initialChoice(occ({}))).toBe("create");
    expect(initialChoice(occ({ status: "overlap", existingShift: EXISTING }))).toBe("skip");
    expect(initialChoice(occ({ status: "leave" }))).toBe("skip");
  });

  it("só substitui sobreposições sem presença registada", () => {
    expect(canReplace(occ({ status: "overlap", existingShift: EXISTING }))).toBe(true);
    expect(canReplace(occ({ status: "overlap", existingShift: EXISTING, existingHasAttendance: true }))).toBe(false);
    expect(canReplace(occ({ status: "duplicate", existingShift: EXISTING }))).toBe(false);
  });

  it("monta uma decisão por ocorrência e conta os turnos a criar", () => {
    const list = [
      occ({ key: "a" }),
      occ({ key: "b" }),
      occ({ key: "c", status: "overlap", existingShift: EXISTING }),
      occ({ key: "d", status: "overlap", existingShift: EXISTING, existingHasAttendance: true }),
      occ({ key: "e", status: "leave" }),
    ];
    const choices = { b: "skip" as const, c: "replace" as const, d: "replace" as const, e: "create" as const };
    expect(buildDecisions(list, choices)).toEqual({
      a: { action: "create" },
      b: { action: "skip" },
      c: { action: "replace", existingShiftId: "s1" },
      d: { action: "skip" },
      e: { action: "skip" },
    });
    expect(countToCreate(list, choices)).toBe(2);
  });

  it("formata a data com o dia da semana", () => {
    expect(formatOccurrenceDate("2026-11-07")).toBe("Sáb, 07/11/2026");
  });
});
