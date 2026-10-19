import { describe, expect, it } from "vitest";
import { minuteOfDay, placeSegments, plannedBand, plannedBands } from "./timeline.service.ts";

const TZ = "Europe/Lisbon";

describe("linha do dia (posições, sem recalcular horas)", () => {
  it("minutos locais no fuso da organização, incluindo horário de verão", () => {
    // 18/10/2026 ainda é WEST (UTC+1): 08:00Z = 09:00 local.
    expect(minuteOfDay("2026-10-18T08:00:00Z", "2026-10-18", TZ)).toBe(9 * 60);
    // 26/10/2026 já é WET (UTC+0): 08:00Z = 08:00 local.
    expect(minuteOfDay("2026-10-26T08:00:00Z", "2026-10-26", TZ)).toBe(8 * 60);
  });

  it("turno que cruza a meia-noite fica cortado e assinalado nos dois dias", () => {
    const seg = [{ start: "2026-10-18T21:00:00Z", end: "2026-10-19T02:00:00Z", type: "work" as const }]; // 22:00–03:00 local
    const [today] = placeSegments(seg, "2026-10-18", TZ);
    expect(today).toMatchObject({ start: 22 * 60, left: 22 * 60, width: 120, toNextDay: true, fromPreviousDay: false });
    const [next] = placeSegments(seg, "2026-10-19", TZ);
    expect(next).toMatchObject({ left: 0, width: 180, fromPreviousDay: true, toNextDay: false });
  });

  it("faixa curta nunca desaparece; em curso e fechada automaticamente são assinaladas", () => {
    const [s] = placeSegments([{ start: "2026-10-18T09:00:00Z", end: "2026-10-18T09:01:00Z", type: "break_unpaid", open: true, autoClosed: false }], "2026-10-18", TZ);
    expect(s).toMatchObject({ width: 4, open: true, autoClosed: false });
    const [w] = placeSegments([{ start: "2026-10-18T09:00:00Z", end: "2026-10-18T10:00:00Z", type: "work" }], "2026-10-18", TZ);
    expect(w).toMatchObject({ open: false, autoClosed: false });
  });

  it("previsto noturno termina no dia seguinte", () => {
    expect(plannedBand("09:00", "17:00")).toEqual({ start: 540, end: 1020 });
    expect(plannedBand("22:00", "06:00")).toEqual({ start: 1320, end: 1800 });
    expect(plannedBand("09:00", null)).toEqual({ start: 540, end: 1440 });
    // Passa a meia-noite: dois troços na linha do dia (fim do dia + início do dia).
    expect(plannedBands("23:00", "07:00")).toEqual([
      { start: 1380, end: 1440, cutLeft: false, cutRight: true },
      { start: 0, end: 420, cutLeft: true, cutRight: false },
    ]);
    expect(plannedBands("09:00", "17:00")).toEqual([{ start: 540, end: 1020, cutLeft: false, cutRight: false }]);
    expect(plannedBands("16:00", "00:00")).toEqual([{ start: 960, end: 1440, cutLeft: false, cutRight: false }]);
  });
});
