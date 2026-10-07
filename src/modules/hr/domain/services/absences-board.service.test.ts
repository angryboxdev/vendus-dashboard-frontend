import { describe, expect, it } from "vitest";
import type { AbsenceRecord } from "../entities/absences.ts";
import { calendarDays, calendarName, filterRecords, monthRange, recordsCsv, recordsOnDay, shiftMonth, tabCounts } from "./absences-board.service.ts";

const rec = (o: Partial<AbsenceRecord>): AbsenceRecord => ({
  id: "a",
  source: "absence",
  employeeId: "e1",
  employeeName: "CARLOS ANDRÉS MONTOYA",
  positionName: "Preparador",
  locationId: "loc-1",
  locationName: "Loja Teste",
  type: "vacation",
  startDate: "2026-10-12",
  endDate: "2026-10-16",
  startTime: null,
  endTime: null,
  duration: "5 dias úteis",
  status: "approved",
  affectedShifts: 3,
  notes: null,
  origin: "hr",
  decisionNote: null,
  ...o,
});

describe("Férias & Ausências — regras do quadro", () => {
  it("meses e grelha segunda a domingo", () => {
    expect(monthRange("2026-10")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    const days = calendarDays("2026-10");
    expect(days[0]).toBe("2026-09-28");
    expect(days).toHaveLength(42);
  });

  it("filtros (sem acentos), separadores e dias", () => {
    const rs = [rec({ id: "1" }), rec({ id: "2", employeeName: "LUCAS ALMEIDA", type: "sick_leave", status: "pending" }), rec({ id: "3", status: "cancelled" })];
    expect(filterRecords(rs, { search: "andres", type: "", locationId: "" }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterRecords(rs, { search: "", type: "sick_leave", locationId: "" }).map((r) => r.id)).toEqual(["2"]);
    expect(tabCounts(rs)).toEqual({ all: 3, pending: 1, approved: 1, closed: 1 });
    expect(recordsOnDay(rs, "2026-10-13").map((r) => r.id)).toEqual(["1", "2"]);
    expect(calendarName("CARLOS ANDRÉS MONTOYA")).toBe("Carlos Andrés");
  });

  it("exportação CSV com ';'", () => {
    const csv = recordsCsv([rec({ notes: "a; b" })]);
    expect(csv.split("\n")[1]).toBe('CARLOS ANDRÉS MONTOYA;Preparador;Loja Teste;12/10/2026;16/10/2026;Férias;5 dias úteis;Aprovado;3;"a; b"');
  });
});
