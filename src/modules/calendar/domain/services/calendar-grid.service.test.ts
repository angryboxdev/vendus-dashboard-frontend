import { describe, expect, it } from "vitest";
import { monthGrid, monthTitle, shortDate, startOfWeek, visibleRange, weekDays } from "./calendar-grid.service.ts";

describe("calendar-grid.service", () => {
  it("semanas começam à segunda e cobrem o mês inteiro", () => {
    const weeks = monthGrid("2026-08-15");
    expect(weeks[0]![0]).toBe("2026-07-27"); // 1 de agosto de 2026 é sábado
    expect(weeks.at(-1)![6]).toBe("2026-09-06");
    expect(weeks.flat()).toContain("2026-08-31");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("vista semana e intervalo pedido ao backend", () => {
    expect(startOfWeek("2026-10-05")).toBe("2026-10-05");
    expect(weekDays("2026-10-08")).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"]);
    expect(visibleRange("week", "2026-10-08")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
  });

  it("formatos de título", () => {
    expect(monthTitle("2026-10-06")).toBe("Outubro 2026");
    expect(shortDate("2026-10-14")).toBe("14 OUT");
  });
});
