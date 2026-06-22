import { describe, expect, it } from "vitest";
import {
  getMondayOfWeek,
  getWeekDays,
  nextWeekMonday,
  prevWeekMonday,
  getMonthRange,
  nextMonth,
  prevMonth,
  formatDayLabel,
  formatWeekLabel,
  formatMonthLabel,
} from "./closings-period.ts";

describe("getMondayOfWeek", () => {
  it("returns itself when day is already Monday", () => {
    expect(getMondayOfWeek("2026-06-15")).toBe("2026-06-15"); // Monday
  });

  it("returns previous Monday for Wednesday", () => {
    expect(getMondayOfWeek("2026-06-17")).toBe("2026-06-15"); // Wed → Mon
  });

  it("returns previous Monday for Sunday", () => {
    expect(getMondayOfWeek("2026-06-21")).toBe("2026-06-15"); // Sun → Mon of same week
  });

  it("returns previous Monday for Saturday", () => {
    expect(getMondayOfWeek("2026-06-20")).toBe("2026-06-15"); // Sat → Mon
  });

  it("crosses month boundary correctly", () => {
    expect(getMondayOfWeek("2026-06-01")).toBe("2026-06-01"); // 1 Jun 2026 is a Monday
  });
});

describe("getWeekDays", () => {
  it("returns 7 days starting from the given Monday", () => {
    const days = getWeekDays("2026-06-15");
    expect(days).toHaveLength(7);
    expect(days[0]).toBe("2026-06-15"); // Mon
    expect(days[6]).toBe("2026-06-21"); // Sun
  });

  it("returns sequential days in order", () => {
    const days = getWeekDays("2026-06-15");
    expect(days).toEqual([
      "2026-06-15",
      "2026-06-16",
      "2026-06-17",
      "2026-06-18",
      "2026-06-19",
      "2026-06-20",
      "2026-06-21",
    ]);
  });

  it("crosses month boundary correctly", () => {
    const days = getWeekDays("2026-06-29");
    expect(days[0]).toBe("2026-06-29");
    expect(days[6]).toBe("2026-07-05");
  });
});

describe("nextWeekMonday / prevWeekMonday", () => {
  it("nextWeekMonday adds exactly 7 days", () => {
    expect(nextWeekMonday("2026-06-15")).toBe("2026-06-22");
  });

  it("prevWeekMonday subtracts exactly 7 days", () => {
    expect(prevWeekMonday("2026-06-15")).toBe("2026-06-08");
  });

  it("next then prev returns to original", () => {
    const original = "2026-06-15";
    expect(prevWeekMonday(nextWeekMonday(original))).toBe(original);
  });

  it("crosses year boundary", () => {
    expect(nextWeekMonday("2025-12-29")).toBe("2026-01-05");
    expect(prevWeekMonday("2026-01-05")).toBe("2025-12-29");
  });
});

describe("getMonthRange", () => {
  it("returns correct range for January", () => {
    expect(getMonthRange(2026, 1)).toEqual({ from: "2026-01-01", to: "2026-01-31" });
  });

  it("returns correct range for February in non-leap year", () => {
    expect(getMonthRange(2026, 2)).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("returns correct range for February in leap year", () => {
    expect(getMonthRange(2024, 2)).toEqual({ from: "2024-02-01", to: "2024-02-29" });
  });

  it("returns correct range for December", () => {
    expect(getMonthRange(2026, 12)).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });

  it("returns correct range for June (30-day month)", () => {
    expect(getMonthRange(2026, 6)).toEqual({ from: "2026-06-01", to: "2026-06-30" });
  });
});

describe("nextMonth / prevMonth", () => {
  it("nextMonth increments month", () => {
    expect(nextMonth(2026, 6)).toEqual({ year: 2026, month: 7 });
  });

  it("nextMonth wraps December to January of next year", () => {
    expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
  });

  it("prevMonth decrements month", () => {
    expect(prevMonth(2026, 6)).toEqual({ year: 2026, month: 5 });
  });

  it("prevMonth wraps January to December of previous year", () => {
    expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });

  it("next then prev returns to original", () => {
    const start = { year: 2026, month: 6 };
    const { year, month } = prevMonth(nextMonth(start.year, start.month).year, nextMonth(start.year, start.month).month);
    expect({ year, month }).toEqual(start);
  });
});

describe("formatDayLabel", () => {
  it("returns correct day name, number and month for a Monday", () => {
    const label = formatDayLabel("2026-06-15"); // Monday, 15 Jun
    expect(label.short).toBe("Seg");
    expect(label.num).toBe(15);
    expect(label.month).toBe("Jun");
  });

  it("returns correct day name for Sunday", () => {
    expect(formatDayLabel("2026-06-21").short).toBe("Dom");
  });

  it("returns correct month name for January", () => {
    expect(formatDayLabel("2026-01-01").month).toBe("Jan");
  });

  it("returns correct month name for December", () => {
    expect(formatDayLabel("2026-12-31").month).toBe("Dez");
  });
});

describe("formatWeekLabel", () => {
  it("same-month week shows single month name", () => {
    const label = formatWeekLabel("2026-06-15"); // 15–21 Jun 2026
    expect(label).toBe("15–21 Jun 2026");
  });

  it("cross-month week shows both month names", () => {
    const label = formatWeekLabel("2026-06-29"); // 29 Jun – 5 Jul 2026
    expect(label).toBe("29 Jun – 5 Jul 2026");
  });

  it("cross-year week shows both month names with last year", () => {
    const label = formatWeekLabel("2025-12-29"); // 29 Dez – 4 Jan 2026
    expect(label).toBe("29 Dez – 4 Jan 2026");
  });
});

describe("formatMonthLabel", () => {
  it("returns abbreviated month name and year", () => {
    expect(formatMonthLabel(2026, 6)).toBe("Jun 2026");
  });

  it("returns correct name for January", () => {
    expect(formatMonthLabel(2025, 1)).toBe("Jan 2025");
  });

  it("returns correct name for December", () => {
    expect(formatMonthLabel(2026, 12)).toBe("Dez 2026");
  });
});
