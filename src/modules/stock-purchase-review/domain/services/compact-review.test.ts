import { describe, expect, it } from "vitest";
import type { StockPurchaseReviewDTO, StockReviewLineDTO } from "../entities/stock-purchase-review.ts";
import { compactKpis, compactRows, matchesFilter, sortRows } from "./compact-review.ts";

const line = (over: Partial<StockReviewLineDTO>): StockReviewLineDTO => ({
  id: "x", invoiceLineId: "x", description: "", purchaseQuantity: 1, purchaseUnit: "un", unitCostWithoutVat: 0, totalWithVat: 0, vatAmount: 0,
  netAmount: 0, discountAmount: 0, supplierItemCode: null, costCenterCategoryId: null, locationSplits: null, suggestion: null,
  resolutionType: "existing_item", stockItemId: null, conversionFactor: 1000, stockQuantity: null, locationId: null,
  unitCostPerBaseUnitWithVat: null, unitCostPerBaseUnitWithoutVat: null, flaggedSuspiciousConversion: false, flagReason: null, resolvedBy: null, resolvedAt: null,
  ...over,
});

// FT 63388 (task V5 §4.2): 5 linhas, 4 artigos, Cheddar em dois lotes.
const lines = [
  line({ id: "mozz", description: "Q. Mozzarella ralado 100% Eurial kg", purchaseQuantity: 40, stockItemId: "mozz", stockQuantity: 40000, netAmount: 22320, supplierItemCode: "44641004" }),
  line({ id: "grana", description: "Q. Grana Padano Ralado Maser 1 kg", purchaseQuantity: 1, stockItemId: "grana", stockQuantity: 1000, netAmount: 1481 }),
  line({ id: "ch-a", description: "Q. Cheddar Ralado kg", purchaseQuantity: 6, stockItemId: "cheddar", stockQuantity: 6000, netAmount: 4674 }),
  line({ id: "ch-b", description: "Q. Cheddar Ralado kg", purchaseQuantity: 1, stockItemId: "cheddar", stockQuantity: 1000, netAmount: 779 }),
  line({ id: "tomate", description: "Tomate Mutti p/ Pizza Classico 5 kg bolsa", purchaseQuantity: 4, stockItemId: "tomate", conversionFactor: 5000, stockQuantity: 20000, netAmount: 3845 }),
];
const review = { lines, invoiceNetCents: 33099, invoiceVatCents: 2639, invoiceTotalCents: 35738 } as unknown as StockPurchaseReviewDTO;
const items: Record<string, { name: string; baseUnit: string }> = {
  mozz: { name: "Mozzarela Ralado", baseUnit: "g" }, grana: { name: "Grana Padano", baseUnit: "g" }, cheddar: { name: "Cheddar Ralado", baseUnit: "g" }, tomate: { name: "Tomate Mutti", baseUnit: "g" },
};

describe("lista compacta da conciliação (V5 §2)", () => {
  it("T01/T02: 5 linhas do documento, 4 artigos; Cheddar 6 + 1 kg → 7 000 g e 54,53 € numa linha, com as 2 linhas por baixo", () => {
    expect(compactKpis(review)).toMatchObject({ documentLines: 5, stockItems: 4, netCents: 33099, totalCents: 35738, pending: 0 });
    const rows = compactRows(review, (id) => items[id]);
    expect(rows.map((r) => [r.label, r.invoiced, r.expected?.quantity, r.netCents, r.lines.length])).toEqual([
      ["Mozzarela Ralado", "40 kg", 40000, 22320, 1],
      ["Grana Padano", "1 un", 1000, 1481, 1],
      ["Cheddar Ralado", "6 + 1 kg", 7000, 5453, 2],
      ["Tomate Mutti", "4 un", 20000, 3845, 1],
    ]);
  });

  it("estados, filtros e ordem: Stock → Por rever → Fora do Stock", () => {
    const mixed = {
      ...review,
      lines: [
        line({ id: "out", description: "Saco de lixo", resolutionType: "no_stock_effect" }),
        line({ id: "rev", description: "Produto novo", resolutionType: "unresolved", stockItemId: null }),
        line({ id: "conf", description: "Farinha T65 25 kg", resolutionType: "unresolved", stockItemId: null, suggestion: { source: "name_match", resolution: "existing_item", stockItemId: "far", conversionFactor: 25000, confidence: 0.9, packagingChanged: false } as never }),
        lines[0]!,
      ],
    } as StockPurchaseReviewDTO;
    const rows = sortRows(compactRows(mixed, (id) => items[id]));
    expect(rows.map((r) => [r.key, r.state])).toEqual([["mozz", "resolved"], ["rev", "review"], ["conf", "confirm"], ["out", "out"]]);
    expect(rows.filter((r) => matchesFilter(r, "pending")).map((r) => r.key)).toEqual(["rev", "conf"]);
    expect(rows.filter((r) => matchesFilter(r, "out")).map((r) => r.key)).toEqual(["out"]);
    expect(compactKpis(mixed).pending).toBe(2);
  });
});

describe("coluna «Na fatura» para conferir (V5)", () => {
  it("embalagem confirmada: 16 sacos × 2,5 kg = 40 kg (saco guardado em g, fatura em kg)", async () => {
    const { invoiceBreakdown } = await import("./compact-review.ts");
    const mozz = line({
      description: "Q. Mozzarella ralado 100% Eurial kg", purchaseQuantity: 40, unitCostWithoutVat: 620,
      packaging: { presentation: { packageUnit: "saco", contentQuantity: 2500, contentUnit: "g", invoicedBy: "content", minOrderPackages: 1, orderIncrementPackages: 1 } as never, preview: { conversionFactor: 1000, stockQuantity: 40000, packages: 16, netCostPerBaseUnit: 0.558, netCostPerContentUnit: 0.558, netCostPerPackage: 1395 }, baseUnit: "g" },
    });
    expect(invoiceBreakdown(mozz)).toBe("16 sacos × 2,5 kg = 40 kg");
  });

  it("embalagem na descrição: 4 bolsas × 5 kg = 20 kg; 1 × 1 kg = 1 kg; sem embalagem: 6 kg × 8,20 €", async () => {
    const { invoiceBreakdown } = await import("./compact-review.ts");
    expect(invoiceBreakdown(line({ description: "Tomate Mutti p/ Pizza Classico 5 kg bolsa", purchaseQuantity: 4 }))).toBe("4 bolsas × 5 kg = 20 kg");
    expect(invoiceBreakdown(line({ description: "Q. Grana Padano Ralado Maser 1 kg", purchaseQuantity: 1 }))).toBe("1 × 1 kg = 1 kg");
    expect(invoiceBreakdown(line({ description: "Q. Cheddar Ralado kg", purchaseQuantity: 6, unitCostWithoutVat: 820 }))).toBe("6 kg × 8,20 €");
  });
});
