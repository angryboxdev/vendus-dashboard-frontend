import { describe, expect, it } from "vitest";
import { frequencyLabel, priceSeries } from "./supplier-planning.ts";

describe("priceSeries", () => {
  it("últimos N meses até ao atual, com null nos meses sem compra", () => {
    const s = priceSeries([{ month: "2026-08", avgUnitPrice: 5.2 }, { month: "2026-10", avgUnitPrice: 5.8 }, { month: "2025-01", avgUnitPrice: 1 }], 3, new Date("2026-10-25T12:00:00Z"));
    expect(s).toEqual([
      { month: "2026-08", label: "Ago", price: 5.2 },
      { month: "2026-09", label: "Set", price: null },
      { month: "2026-10", label: "Out", price: 5.8 },
    ]);
  });

  it("atravessa o ano", () => {
    expect(priceSeries([], 3, new Date("2026-01-10T12:00:00Z")).map((p) => p.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("frequencyLabel", () => {
  it.each([[null, "—"], [1, "1 dia"], [6.5, "6,5 dias"], [12, "12 dias"]] as const)("%s → %s", (d, label) => {
    expect(frequencyLabel(d)).toBe(label);
  });
});
