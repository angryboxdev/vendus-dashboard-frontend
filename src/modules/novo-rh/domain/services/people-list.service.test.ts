import { describe, expect, it } from "vitest";
import type { PersonDayView } from "../entities/overview.ts";
import { mergeStoredColumns, todayHours, todaySchedule, weeklyHoursLabel } from "./people-list.service.ts";

const day = (over: Partial<PersonDayView> = {}): PersonDayView => ({
  date: "2026-10-18", status: "working", lateMinutes: 0, workedSeconds: 0, theoreticalSeconds: 0,
  plannedStart: null, plannedEnd: null, firstInAt: null, absenceType: null, ...over,
});

describe("todaySchedule («Horário» de hoje)", () => {
  it("horas planeadas, folga, ausência, flexível, sem horário e sem dados", () => {
    expect(todaySchedule(day({ plannedStart: "09:00", plannedEnd: "17:00", theoreticalSeconds: 28800 }))).toEqual({ kind: "hours", text: "09:00–17:00" });
    expect(todaySchedule(day({ status: "day_off" }))).toEqual({ kind: "day_off" });
    expect(todaySchedule(day({ status: "absent", absenceType: "Férias", plannedStart: "09:00" }))).toEqual({ kind: "absent", absenceType: "Férias" });
    expect(todaySchedule(day({ theoreticalSeconds: 28800 }))).toEqual({ kind: "flexible", theoreticalSeconds: 28800 });
    expect(todaySchedule(day({ status: "not_started" }))).toEqual({ kind: "none" });
    expect(todaySchedule(undefined)).toEqual({ kind: "unknown" });
  });
});

describe("todayHours («Horas hoje»)", () => {
  it("barra = trabalhado / previsto, limitada a 100%; sem previsto não há barra; sem dados → null", () => {
    expect(todayHours(day({ workedSeconds: 14400, theoreticalSeconds: 28800 }))).toEqual({ workedSeconds: 14400, theoreticalSeconds: 28800, ratio: 0.5 });
    expect(todayHours(day({ workedSeconds: 36000, theoreticalSeconds: 28800 }))!.ratio).toBe(1);
    expect(todayHours(day({ workedSeconds: 3600 }))!.ratio).toBeNull();
    expect(todayHours(undefined)).toBeNull();
  });
});

describe("weeklyHoursLabel", () => {
  it("formata as horas do contrato com vírgula; sem contrato → null", () => {
    expect(weeklyHoursLabel(40)).toBe("40h");
    expect(weeklyHoursLabel(37.5)).toBe("37,5h");
    expect(weeklyHoursLabel(null)).toBeNull();
    expect(weeklyHoursLabel(undefined)).toBeNull();
  });
});

describe("mergeStoredColumns", () => {
  const ALL = ["nif", "schedule", "hoursToday", "status"] as const;
  const DEF = ["nif", "schedule", "hoursToday", "status"] as const;
  it("formato antigo (lista): mantém a escolha e mostra as colunas novas uma vez", () => {
    expect(mergeStoredColumns(["status"], ALL, DEF, ["schedule", "hoursToday"])).toEqual(["schedule", "hoursToday", "status"]);
  });
  it("formato novo: coluna conhecida e desligada continua desligada", () => {
    expect(mergeStoredColumns({ cols: ["status"], known: [...ALL] }, ALL, DEF, ["schedule", "hoursToday"])).toEqual(["status"]);
  });
  it("sem nada guardado → null (usar as colunas por omissão)", () => {
    expect(mergeStoredColumns(null, ALL, DEF, [])).toBeNull();
  });
});
