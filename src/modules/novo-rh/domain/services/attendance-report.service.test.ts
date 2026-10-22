import { describe, expect, it } from "vitest";
import { chunks, compliance, exportRows, grandTotals, punctuality, reportLines, reportRange, teamSeries, type ReportDay } from "./attendance-report.service.ts";

const day = (employeeId: string, workDate: string, over: Partial<ReportDay> = {}): ReportDay => ({
  employeeId, workDate, worked: 8 * 3600, planned: 8 * 3600, late: false, lateMinutes: 0, missing: false, forgotten: false, excused: false, ...over,
});
const PEOPLE = [
  { id: "e2", name: "Rui Teste", locationId: "l1", hireDate: "2025-01-01" },
  { id: "e1", name: "Ana Teste", locationId: "l1", hireDate: "2026-03-10" },
];

describe("Relatório de assiduidade — regras do ecrã", () => {
  it("períodos terminam hoje; mês anterior inteiro; desde a admissão com teto de 2 anos", () => {
    expect(reportRange("week", "2026-10-22", null)).toEqual({ from: "2026-10-19", to: "2026-10-22" });
    expect(reportRange("month", "2026-10-22", null)).toEqual({ from: "2026-10-01", to: "2026-10-22" });
    expect(reportRange("lastMonth", "2026-10-22", null)).toEqual({ from: "2026-09-01", to: "2026-09-30" });
    expect(reportRange("year", "2026-10-22", null)).toEqual({ from: "2026-01-01", to: "2026-10-22" });
    expect(reportRange("since", "2026-10-22", "2026-03-10")).toEqual({ from: "2026-03-10", to: "2026-10-22" });
    expect(reportRange("since", "2026-10-22", "2019-01-01").from).toBe("2024-10-22");
  });

  it("blocos por mês de calendário, nunca mais de 31 dias", () => {
    expect(chunks("2026-09-15", "2026-11-03")).toEqual([
      { from: "2026-09-15", to: "2026-09-30" },
      { from: "2026-10-01", to: "2026-10-31" },
      { from: "2026-11-01", to: "2026-11-03" },
    ]);
  });

  it("linhas por pessoa (total) incluem quem não tem dias; por mês separa os períodos", () => {
    const days = [
      day("e2", "2026-09-30", { late: true, lateMinutes: 15, worked: 7 * 3600 }),
      day("e2", "2026-10-01", { worked: 0, missing: true }),
      day("e2", "2026-10-02", { planned: 0, worked: 0, excused: true }),
    ];
    const total = reportLines(PEOPLE, days, "total");
    expect(total.map((l) => l.person.name)).toEqual(["Ana Teste", "Rui Teste"]);
    expect(total[0]!.totals.plannedDays).toBe(0);
    expect(total[1]!.totals).toMatchObject({ plannedDays: 2, workedDays: 1, late: 1, lateMinutes: 15, missing: 1, excused: 1 });
    expect(compliance(total[1]!.totals)).toBe(44);
    expect(punctuality(total[1]!.totals)).toBe(0);
    expect(reportLines(PEOPLE, days, "month").map((l) => l.periodLabel)).toEqual(["set 2026", "out 2026"]);
    expect(grandTotals(days)).toMatchObject({ missing: 1, late: 1 });
    expect(teamSeries(days, "total").map((s) => s.label)).toEqual(["set", "out"]);
    expect(exportRows(total)[1]).toEqual(["Rui Teste", "Total", 16, 7, -9, 44, 2, 1, 1, 15, 1, 0, 1, 0]);
  });
});
