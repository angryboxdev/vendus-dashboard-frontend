import { describe, expect, it } from "vitest";
import type { AbsenceRequest } from "../entities/absences.ts";
import type { AttendanceDays } from "../entities/attendance.ts";
import { absenceMarks, monthWeeks, percent, statsBuckets, statsRange } from "./person-overview.service.ts";

const req = (over: Partial<AbsenceRequest>): AbsenceRequest => ({
  id: "r1", employeeId: "e1", typeId: "t1", typeName: "Férias", typeColor: "#2563EB", private: false, kind: "absence",
  startDate: "2026-03-02", endDate: "2026-03-04", startTime: null, endTime: null, halfDay: false, amount: 3, unit: "days",
  period: "2026", status: "approved", comment: null, requestedBy: "u1", levels: [], currentLevel: 0, cancelReason: null, createdAt: "2026-02-01T00:00:00Z",
  ...over,
});

const day = (workDate: string, workedSeconds: number, theoreticalSeconds: number, incidents: string[] = []) =>
  ({ workDate, workedSeconds, theoreticalSeconds, incidents, breakSeconds: 0, nightSeconds: 0, excessSeconds: 0, pendingSeconds: 0, segments: [], version: 1 }) as unknown as AttendanceDays["days"][number];

describe("Ficha do colaborador — calendário e estatísticas", () => {
  it("semanas começam à segunda e completam com vazios", () => {
    const weeks = monthWeeks(2026, 1); // 1 jan 2026 é quinta-feira
    expect(weeks[0]).toEqual([null, null, null, "2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04"]);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean)).toHaveLength(31);
  });

  it("marca aprovadas e pendentes, ignora recusadas/canceladas e o aprovado ganha", () => {
    const marks = absenceMarks(
      [
        req({ id: "a", status: "pending", startDate: "2026-03-03", endDate: "2026-03-05" }),
        req({ id: "b" }),
        req({ id: "c", status: "rejected", startDate: "2026-03-10", endDate: "2026-03-10" }),
        req({ id: "d", status: "approved", startDate: "2025-12-30", endDate: "2026-01-02" }),
      ],
      "2026-01-01",
      "2026-12-31",
    );
    expect(marks.get("2026-03-02")?.status).toBe("approved");
    expect(marks.get("2026-03-04")?.status).toBe("approved");
    expect(marks.get("2026-03-05")?.status).toBe("pending");
    expect(marks.has("2026-03-10")).toBe(false);
    expect(marks.has("2025-12-31")).toBe(false);
    expect(marks.get("2026-01-02")?.status).toBe("approved");
  });

  it("períodos terminam hoje e agrupam por dia, semana ou mês", () => {
    expect(statsRange("month", "2026-10-21")).toEqual({ from: "2026-10-01", to: "2026-10-21", bucket: "day" });
    expect(statsRange("quarter", "2026-10-21")).toEqual({ from: "2026-08-01", to: "2026-10-21", bucket: "week" });
    expect(statsRange("year", "2026-10-21")).toEqual({ from: "2026-01-01", to: "2026-10-21", bucket: "month" });
    const data = { days: [day("2026-10-05", 3600, 7200, ["late"]), day("2026-10-06", 0, 7200, ["missing_in"]), day("2026-10-12", 7200, 7200)] } as AttendanceDays;
    const weeks = statsBuckets(data, "week");
    expect(weeks.map((w) => [w.label, w.worked, w.theoretical, w.missing, w.late])).toEqual([
      ["05/10", 3600, 14400, 1, 1],
      ["12/10", 7200, 7200, 0, 0],
    ]);
    expect(statsBuckets(data, "month")).toEqual([{ key: "2026-10", label: "out", worked: 10800, theoretical: 21600, missing: 1, late: 1 }]);
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });
});
