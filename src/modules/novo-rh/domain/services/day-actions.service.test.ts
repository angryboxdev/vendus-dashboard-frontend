import { describe, expect, it } from "vitest";
import type { AttendanceDays, ClockEvent, Incident } from "../entities/attendance.ts";
import { dayQuickActions, effectiveEvents } from "./day-actions.service.ts";

// Outubro em Lisboa = UTC+1.
const ev = (id: string, local: string, segmentType: ClockEvent["segmentType"]): ClockEvent => ({ id, employeeId: "e1", occurredAt: new Date(`${local}+01:00`).toISOString(), segmentType, source: "web", locationId: null });
const inc = (type: Incident["type"], status: Incident["status"] = "open"): Incident => ({ id: `i-${type}`, employeeId: "e1", workDate: "2026-10-09", type, source: "engine", status, comment: null, resolvedBy: null, resolvedAt: null });
const NOW = "2026-10-12T10:00:00.000Z";

function data(over: Partial<AttendanceDays> & { incidents?: Incident[]; dayIncidents?: AttendanceDays["days"][number]["incidents"]; plannedStart?: string | null; plannedEnd?: string | null } = {}): AttendanceDays {
  const { dayIncidents = [], plannedStart = "09:00", plannedEnd = "17:00", ...rest } = over;
  return {
    employeeId: "e1",
    timeZone: "Europe/Lisbon",
    days: [{ workDate: "2026-10-09", workedSeconds: 0, breakSeconds: 0, nightSeconds: 0, theoreticalSeconds: 8 * 3600, excessSeconds: 0, pendingSeconds: 0, segments: [], incidents: dayIncidents, plannedStart, plannedEnd }],
    totals: { workedSeconds: 0, theoreticalSeconds: 0, excessSeconds: 0, pendingSeconds: 0, nightSeconds: 0 },
    events: [],
    revisions: [],
    incidents: [],
    refusable: [],
    ...rest,
  };
}

describe("Ações rápidas do dia (atraso / falta)", () => {
  it("atraso: «Cumpriu horário» recua a entrada para a hora prevista", () => {
    const d = data({ dayIncidents: ["late"], events: [ev("ev1", "2026-10-09T09:25:00", "work"), ev("ev2", "2026-10-09T17:00:00", "off")], incidents: [inc("late")] });
    const a = dayQuickActions(d, "2026-10-09", NOW)!;
    expect(a.kind).toBe("late");
    expect(a.lateMinutes).toBe(25);
    expect(a.incident?.id).toBe("i-late");
    expect(a.fulfilled).toEqual([{ operation: "update", targetEventId: "ev1", occurredAt: "2026-10-09T08:00:00.000Z", segmentType: null }]);
  });

  it("atraso sobre uma entrada já corrigida usa a hora em vigor e o id da revisão", () => {
    const d = data({
      dayIncidents: ["late"],
      events: [ev("ev1", "2026-10-09T09:10:00", "work")],
      revisions: [
        { id: "r1", employeeId: "e1", operation: "void", targetEventId: "ev1", occurredAt: null, segmentType: null, reason: "x", author: "g", state: "active", refusableUntil: null, anchorAt: "2026-10-09T08:10:00.000Z", createdAt: "2026-10-10T08:00:00.000Z" },
        { id: "r2", employeeId: "e1", operation: "add", targetEventId: null, occurredAt: "2026-10-09T08:40:00.000Z", segmentType: "work", reason: "x", author: "g", state: "active", refusableUntil: null, anchorAt: "2026-10-09T08:40:00.000Z", createdAt: "2026-10-10T08:01:00.000Z" },
      ],
    });
    const a = dayQuickActions(d, "2026-10-09", NOW)!;
    expect(a.lateMinutes).toBe(40);
    expect(a.incident).toBeNull();
    expect(a.fulfilled?.[0]?.targetEventId).toBe("rev:r2");
  });

  it("não recua a entrada por cima da marcação anterior (fica só confirmar/justificar)", () => {
    const d = data({ plannedStart: "00:00", plannedEnd: "08:00", dayIncidents: ["late"], events: [ev("ev0", "2026-10-09T00:14:00", "off"), ev("ev1", "2026-10-09T00:30:00", "work")] });
    expect(dayQuickActions(d, "2026-10-09", NOW)!.fulfilled).toBeNull();
  });

  it("falta: «Cumpriu horário» acrescenta entrada e saída previstas", () => {
    const d = data({ dayIncidents: ["missing_in"], incidents: [inc("missing_in")] });
    const a = dayQuickActions(d, "2026-10-09", NOW)!;
    expect(a.kind).toBe("absent");
    expect(a.fulfilled).toEqual([
      { operation: "add", targetEventId: null, occurredAt: "2026-10-09T08:00:00.000Z", segmentType: "work" },
      { operation: "add", targetEventId: null, occurredAt: "2026-10-09T16:00:00.000Z", segmentType: "off" },
    ]);
  });

  it("turno noturno: a saída prevista fica no dia seguinte", () => {
    const d = data({ plannedStart: "22:00", plannedEnd: "06:00", dayIncidents: ["missing_in"] });
    expect(dayQuickActions(d, "2026-10-09", NOW)!.fulfilled?.[1]?.occurredAt).toBe("2026-10-10T05:00:00.000Z");
  });

  it("sem horário previsto, ou dia sem atraso nem falta → sem ações", () => {
    expect(dayQuickActions(data({ plannedStart: null, dayIncidents: ["missing_in"] }), "2026-10-09", NOW)).toBeNull();
    expect(dayQuickActions(data({ events: [ev("ev1", "2026-10-09T08:55:00", "work")] }), "2026-10-09", NOW)).toBeNull();
  });

  it("incidente já resolvido continua visível (para mostrar o desfecho)", () => {
    const d = data({ dayIncidents: ["late"], events: [ev("ev1", "2026-10-09T09:25:00", "work")], incidents: [inc("late", "dismissed")] });
    expect(dayQuickActions(d, "2026-10-09", NOW)!.incident?.status).toBe("dismissed");
  });

  it("effectiveEvents ignora revisões recusadas", () => {
    const events = [ev("ev1", "2026-10-09T09:25:00", "work")];
    const refused = { id: "r1", employeeId: "e1", operation: "void" as const, targetEventId: "ev1", occurredAt: null, segmentType: null, reason: "x", author: "g", state: "refused" as const, refusableUntil: null, anchorAt: "", createdAt: "" };
    expect(effectiveEvents(events, [refused]).map((e) => e.id)).toEqual(["ev1"]);
  });
});
