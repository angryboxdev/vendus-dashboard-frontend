import { describe, expect, it } from "vitest";
import { chartRows, isFutureMonth, pctChange, sharePct, totalsUntil, windowLabel } from "./cash-flow-view.ts";
import { sampleReport } from "./fixtures.ts";

describe("chartRows", () => {
  it("um ponto por dia do mês, acumulado em euros, alinhado pelo dia com o período anterior", () => {
    const rows = chartRows(sampleReport());
    expect(rows).toHaveLength(31);
    expect(rows[0]).toEqual({ day: 1, inflow: 1000, outflow: 0, previousInflow: 800, previousOutflow: 200 });
    expect(rows[2]).toEqual({ day: 3, inflow: 1500, outflow: 400, previousInflow: undefined, previousOutflow: undefined });
    expect(rows[3]!.inflow).toBeUndefined();
  });
});

describe("pctChange / sharePct", () => {
  it("variação inteira e null sem base", () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(68, 100)).toBe(-32);
    expect(pctChange(10, 0)).toBeNull();
    expect(sharePct(1, 3)).toBe(33);
    expect(sharePct(1, 0)).toBe(0);
  });
});

describe("windowLabel / totalsUntil", () => {
  it("rótulos «1–16 out.» e totais até ao dia, no mês e no período anterior", () => {
    expect(windowLabel("2026-10-01", "2026-10-16")).toBe("1–16 out.");
    expect(windowLabel("2026-10-01", "2026-10-01")).toBe("1 out.");
    const t = totalsUntil(sampleReport(), 2);
    expect(t.current).toEqual({ inflow: 150_000, outflow: 30_000 });
    expect(t.previous).toEqual({ inflow: 80_000, outflow: 50_000 });
    expect(t.currentLabel).toBe("1–2 mar.");
    expect(t.previousLabel).toBe("1–2 fev.");
  });
});

describe("isFutureMonth", () => {
  it("só os meses depois do atual", () => {
    const today = new Date(2026, 9, 26);
    expect(isFutureMonth(2026, 10, today)).toBe(false);
    expect(isFutureMonth(2026, 11, today)).toBe(true);
    expect(isFutureMonth(2027, 1, today)).toBe(true);
    expect(isFutureMonth(2025, 12, today)).toBe(false);
  });
});
