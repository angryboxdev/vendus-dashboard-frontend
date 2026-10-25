import { describe, expect, it } from "vitest";
import { fromPricingUnitCost, pricingUnit, toPricingUnitCost } from "./pricing-unit.ts";

describe("pricingUnit", () => {
  it("mostra g em kg, ml e cl em l, e o resto como está", () => {
    expect(pricingUnit("g")).toEqual({ label: "kg", factor: 1000 });
    expect(pricingUnit("ml")).toEqual({ label: "l", factor: 1000 });
    expect(pricingUnit("cl")).toEqual({ label: "l", factor: 100 });
    expect(pricingUnit("un")).toEqual({ label: "un", factor: 1 });
  });

  it("converte nos dois sentidos", () => {
    expect(toPricingUnitCost(0.0025, "g")).toBeCloseTo(2.5);
    expect(fromPricingUnitCost(2.5, "g")).toBeCloseTo(0.0025);
    expect(fromPricingUnitCost(3, "cl")).toBeCloseTo(0.03);
    expect(fromPricingUnitCost(0.4, "un")).toBe(0.4);
  });
});
