import { describe, expect, it } from "vitest";
import { dayLabel, punchStateLabel, punchSuccessMessage, refusalMessage, shiftHours } from "./portal-text.service.ts";

describe("textos do Portal", () => {
  it("dia relativo e horário (incl. repartido)", () => {
    expect(dayLabel("2026-10-07", "2026-10-07")).toBe("Hoje");
    expect(dayLabel("2026-10-08", "2026-10-07")).toBe("Amanhã");
    expect(dayLabel("2026-10-09", "2026-10-07")).toBe("Sex 09/10");
    expect(shiftHours({ startTime: "09:00", endTime: "17:00", secondStartTime: null, secondEndTime: null })).toBe("09:00–17:00");
    expect(shiftHours({ startTime: "11:00", endTime: "15:00", secondStartTime: "19:00", secondEndTime: "23:00" })).toBe("11:00–15:00 · 19:00–23:00");
  });

  it("estado da picagem", () => {
    const base = { action: null, blockedReason: null, geofencePolicy: "off" as const };
    expect(punchStateLabel({ ...base, state: "not_in", since: null })).toBe("Ainda não entrou");
    expect(punchStateLabel({ ...base, state: "in", since: "08:58" })).toBe("Entrada registada às 08:58");
    expect(punchStateLabel({ ...base, state: "done", since: "17:02" })).toBe("Saída registada às 17:02");
  });

  it("recusas e confirmação (assinalada quando fora da zona / sem localização)", () => {
    expect(refusalMessage({ code: "TOO_EARLY", shiftStart: "09:00", opensAt: "08:30" })).toBe("O turno começa às 09:00. Pode registar a entrada a partir das 08:30.");
    const ok = { kind: "in" as const, time: "08:58", serverAt: "", geofence: { status: "inside" as const, reason: null, distanceM: 10 }, flagged: false, replay: false };
    expect(punchSuccessMessage(ok)).toBe("Entrada registada às 08:58");
    expect(punchSuccessMessage({ ...ok, flagged: true, geofence: { status: "outside", reason: null, distanceM: 400 } })).toMatch(/fora da zona/);
    expect(punchSuccessMessage({ ...ok, flagged: true, geofence: { status: "unverified", reason: "low_accuracy", distanceM: 120 } })).toMatch(/não foi possível confirmar/);
  });
});
