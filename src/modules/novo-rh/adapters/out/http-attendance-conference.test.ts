import { describe, expect, it } from "vitest";
import { toReviewWeek } from "./http-attendance-api.adapter.ts";

describe("GET /conference → ReviewWeek", () => {
  it("segundos → minutos, sem centro → «Sem centro», decisão com o validado", () => {
    const base = {
      employeeId: "e1",
      phase: "done" as const,
      closed: false,
      restDay: false,
      holiday: false,
      excused: false,
      incomplete: false,
      lateMinutes: 21,
      punches: [{ at: "15:21", kind: "in" as const, nextDay: false }],
      version: 2,
    };
    const w = toReviewWeek({
      from: "2026-10-12",
      to: "2026-10-18",
      people: [{ id: "e1", name: "Ana Teste", locationName: null }],
      days: [
        { ...base, workDate: "2026-10-12", state: "reviewed", plannedRanges: [{ start: "15:00", end: "23:00" }], theoreticalSeconds: 28800, workedSeconds: 27540, validatedSeconds: 28800, review: { id: "r1", decision: "fulfilled", validatedSeconds: 28800, reason: "Erro de picagem", absenceType: null, scope: "day", createdBy: "g@demo.invalid", createdAt: "2026-10-13T10:00:00Z" } },
        { ...base, workDate: "2026-10-13", state: "day_off", plannedRanges: null, theoreticalSeconds: 0, workedSeconds: 0, validatedSeconds: 0, restDay: true, review: null },
      ],
    });
    expect(w.people).toEqual([{ id: "e1", name: "Ana Teste", location: "Sem centro" }]);
    expect(w.days[0]).toMatchObject({ date: "2026-10-12", workedMinutes: 459, plannedMinutes: 480, state: "reviewed", version: 2, review: { id: "r1", validatedMinutes: 480, by: "g@demo.invalid" } });
    expect(w.days[0]!.punches).toEqual([{ at: "15:21", kind: "in" }]);
    expect(w.days[1]).toMatchObject({ planned: null, dayOff: true, review: null });
  });
});
