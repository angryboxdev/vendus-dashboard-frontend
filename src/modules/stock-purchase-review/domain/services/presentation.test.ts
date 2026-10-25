import { describe, expect, it } from "vitest";
import { plural, previewLine, previewSentences, unitFactor } from "./presentation.ts";

const mozzarella = { packageUnit: "saco", contentQuantity: 2.5, contentUnit: "kg" as const, invoicedBy: "content" as const, minOrderPackages: 1, orderIncrementPackages: 1 };

describe("embalagem de compra — pré-visualização (Dream Plus FT 56892)", () => {
  it("20 kg × 6,20 − 10% = 111,60 €, saco de 2,5 kg, artigo em g → 8 sacos, +20 000 g, 5,58 €/kg, 13,95 €/saco", () => {
    const p = previewLine(mozzarella, 20, 11160, "g")!;
    expect(p).toEqual({ conversionFactor: 1000, stockQuantity: 20000, packages: 8, netCostPerBaseUnit: 0.558, netCostPerContentUnit: 558, netCostPerPackage: 1395 });
    const s = previewSentences(mozzarella, p, "g");
    expect(s.packaging).toBe("1 saco = 2,5 kg → 8 sacos");
    expect(s.stock).toMatch(/^\+20\s000 g$/);
    expect(s.cost).toMatch(/5,58\s€\/kg · 13,95\s€\/saco · 0,00558\s€\/g/);
  });

  it("tomate faturado em sacos (4) de 5 kg → +20 kg; dimensões diferentes → null", () => {
    expect(previewLine({ ...mozzarella, contentQuantity: 5, invoicedBy: "package" }, 4, 3845, "kg")).toMatchObject({ conversionFactor: 5, stockQuantity: 20, packages: 4 });
    expect(previewLine(mozzarella, 20, 11160, "l")).toBeNull();
    expect(unitFactor("kg", "g")).toBe(1000);
  });

  it("plural das embalagens", () => {
    expect([plural("saco", 8), plural("saco", 1), plural("garrafão", 2), plural("caixa", 3)]).toEqual(["sacos", "saco", "garrafões", "caixas"]);
  });
});
