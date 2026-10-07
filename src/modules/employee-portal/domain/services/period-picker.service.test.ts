import { describe, expect, it } from "vitest";
import { daysInclusive, isDayDisabled, isInPeriod, monthGrid, periodLabel, pickDay } from "./period-picker.service.ts";

const opts = { today: "2026-10-07", maxDays: 7 };

describe("seletor de período (pedir folga)", () => {
  it("1.º toque início, 2.º fim; antes do início recomeça", () => {
    let p = pickDay({ start: null, end: null }, "2026-10-09", opts);
    expect(p).toEqual({ start: "2026-10-09", end: null });
    p = pickDay(p, "2026-10-12", opts);
    expect(p).toEqual({ start: "2026-10-09", end: "2026-10-12" });
    expect(daysInclusive(p.start!, p.end!)).toBe(4);
    expect(pickDay(p, "2026-10-20", opts)).toEqual({ start: "2026-10-20", end: null });
    expect(pickDay({ start: "2026-10-09", end: null }, "2026-10-08", opts)).toEqual({ start: "2026-10-08", end: null });
  });

  it("nunca dias passados nem mais de 7 dias seguidos", () => {
    expect(pickDay({ start: null, end: null }, "2026-10-06", opts)).toEqual({ start: null, end: null });
    expect(isDayDisabled("2026-10-06", { start: null, end: null }, opts)).toBe(true);
    expect(isDayDisabled("2026-10-15", { start: "2026-10-09", end: null }, opts)).toBe(false);
    expect(isDayDisabled("2026-10-16", { start: "2026-10-09", end: null }, opts)).toBe(true);
  });

  it("grelha, intervalo e rótulos", () => {
    expect(monthGrid("2026-10")[0]).toBe("2026-09-28");
    expect(isInPeriod("2026-10-10", { start: "2026-10-09", end: "2026-10-12" })).toBe(true);
    expect(periodLabel("2026-10-12", "2026-10-14")).toBe("12 – 14 Out 2026");
    expect(periodLabel("2026-10-03", "2026-10-03")).toBe("03 Out 2026");
    expect(periodLabel("2026-09-30", "2026-10-02")).toBe("30 Set – 02 Out 2026");
  });
});
