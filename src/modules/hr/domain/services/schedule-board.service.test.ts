import { describe, expect, it } from "vitest";
import type { WorkShift } from "../entities/schedule.ts";
import { abbreviation, boardRows, dayCounts, dayHeader, hoursLabel, shiftTypeRows, shiftVisualType, shiftWorkMinutes, templateVisualType, weekRangeLabel } from "./schedule-board.service.ts";

const shift = (o: Partial<WorkShift>): WorkShift => ({
  id: "s",
  employeeId: "e1",
  employeeName: "Ana Teste",
  workDate: "2026-10-12",
  startTime: "09:00",
  endTime: "15:00",
  endsNextDay: false,
  secondStartTime: null,
  secondEndTime: null,
  locationId: "l1",
  breakMinutes: 0,
  notes: null,
  status: "published",
  source: "manual",
  rotationId: null,
  seriesId: null,
  templateId: null,
  automationId: null,
  attendanceStatus: null,
  createdAt: "x",
  updatedAt: "x",
  ...o,
});

describe("Grelha de escalas — regras de apresentação", () => {
  it("tipo do turno: partido, noturno, manhã e tarde", () => {
    expect(shiftVisualType(shift({ secondStartTime: "15:00", secondEndTime: "18:30" }))).toBe("split");
    expect(shiftVisualType(shift({ startTime: "22:00", endTime: "04:00", endsNextDay: true }))).toBe("night");
    expect(shiftVisualType(shift({ startTime: "20:00", endTime: "23:30" }))).toBe("night");
    expect(shiftVisualType(shift({ startTime: "09:00" }))).toBe("morning");
    expect(shiftVisualType(shift({ startTime: "16:00", endTime: "22:00" }))).toBe("afternoon");
    expect(templateVisualType({ ...shift({ startTime: "09:30", endTime: "14:30" }), name: "Serviço" })).toBe("other");
  });

  it("horas: períodos menos a pausa, a atravessar a meia-noite", () => {
    expect(shiftWorkMinutes(shift({}))).toBe(360);
    expect(shiftWorkMinutes(shift({ startTime: "22:00", endTime: "04:00", endsNextDay: true }))).toBe(360);
    expect(shiftWorkMinutes(shift({ startTime: "09:00", endTime: "14:00", secondStartTime: "15:00", secondEndTime: "18:30" }))).toBe(510);
    expect(shiftWorkMinutes(shift({ breakMinutes: 30 }))).toBe(330);
    expect(hoursLabel(510)).toBe("8h 30min");
    expect(hoursLabel(360)).toBe("6h");
    expect(hoursLabel(0)).toBe("0h");
  });

  it("cabeçalhos, abreviaturas e período", () => {
    expect(dayHeader(new Date(2026, 9, 12))).toEqual({ weekday: "Segunda-feira", day: 12 });
    expect(abbreviation("manhã")).toBe("Man");
    expect(weekRangeLabel(new Date(2026, 9, 12), new Date(2026, 9, 18))).toBe("12/10/2026 - 18/10/2026");
  });

  it("linhas: atribuídas vs ocultas, pesquisa sem acentos, ordem e horas da semana", () => {
    const people = [
      { id: "e1", fullName: "Cláudia Sousa", positionId: null, primaryLocationId: "l1", photoUrl: null },
      { id: "e2", fullName: "Bruno Sem Turnos", positionId: null, primaryLocationId: "l1", photoUrl: null },
      { id: "e3", fullName: "Outra Loja", positionId: null, primaryLocationId: "l2", photoUrl: null },
    ];
    const shifts = [shift({ id: "a", employeeId: "e1" }), shift({ id: "b", employeeId: "e1", workDate: "2026-10-13" })];
    const base = { search: "", showUnassigned: false, sort: "asc" as const, locationId: "l1" };
    const r = boardRows(people, shifts, base);
    expect(r.rows.map((x) => x.employee.id)).toEqual(["e1"]);
    expect(r.rows[0]!.minutes).toBe(720);
    expect(r).toMatchObject({ assigned: 1, hidden: 1 });
    expect(boardRows(people, shifts, { ...base, showUnassigned: true }).rows.map((x) => x.employee.id)).toEqual(["e2", "e1"]);
    expect(boardRows(people, shifts, { ...base, showUnassigned: true, search: "claudia" }).rows.map((x) => x.employee.id)).toEqual(["e1"]);
    expect(boardRows(people, shifts, { ...base, showUnassigned: true, sort: "desc" }).rows.map((x) => x.employee.id)).toEqual(["e1", "e2"]);
    // Quem tem turnos mas já não está na lista de ativos continua a aparecer.
    expect(boardRows([], [shift({ employeeId: "x9", employeeName: "Antigo" })], base).rows[0]!.employee.fullName).toBe("Antigo");
  });

  it("contagens do dia e agrupamento por turno", () => {
    const shifts = [shift({ id: "a" }), shift({ id: "b", employeeId: "e2" }), shift({ id: "c", workDate: "2026-10-13" })];
    expect(dayCounts(shifts, "2026-10-12")).toEqual({ people: 2, shifts: 2 });
    const groups = shiftTypeRows(shifts, () => "Manhã");
    expect(groups).toHaveLength(1);
    expect(groups[0]!.byDate.get("2026-10-12")).toHaveLength(2);
  });
});
