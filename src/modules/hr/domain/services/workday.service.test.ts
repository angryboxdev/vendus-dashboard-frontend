import { describe, expect, it } from "vitest";
import { classifyWorkday, formatHoursMinutes, plannedShiftMinutes, workdayBadges, workdayRulesError, workdayRulesSummary } from "./workday.service.ts";

const RULES = { standardShiftMinutes: 480, closingToleranceMinutes: 90, doubleShiftFromMinutes: 720 };
const shift = (employeeId: string, startTime: string, endTime: string, endsNextDay = false) => ({ employeeId, startTime, endTime, endsNextDay, secondStartTime: null, secondEndTime: null });

describe("jornada (frontend)", () => {
  it("limpeza depois da meia-noite continua 1 turno; 4h + 8h = dupla", () => {
    expect(classifyWorkday(plannedShiftMinutes(shift("e", "16:00", "01:30", true)), RULES)).toBe(1); // 9h30
    expect(classifyWorkday(240 + 480, RULES)).toBe(2);
    expect(classifyWorkday(600, RULES)).toBe(1.5);
  });

  it("selo por colaborador no dia (soma os turnos do mesmo dia)", () => {
    const badges = workdayBadges([shift("a", "08:00", "12:00"), shift("a", "15:00", "23:00"), shift("b", "10:00", "18:00"), shift("c", "10:00", "23:00")], RULES);
    expect(badges.get("a")).toBe(2);
    expect(badges.has("b")).toBe(false);
    expect(badges.get("c")).toBe(2);
  });

  it("texto e validação dos limites", () => {
    expect(formatHoursMinutes(570)).toBe("9h30");
    expect(workdayRulesSummary(RULES)).toBe("1 turno até 9h30 · 1,5 turnos acima disso · dupla (2 turnos) a partir de 12h");
    expect(workdayRulesError({ ...RULES, doubleShiftFromMinutes: 570 })).not.toBeNull();
    expect(workdayRulesError(RULES)).toBeNull();
  });
});
