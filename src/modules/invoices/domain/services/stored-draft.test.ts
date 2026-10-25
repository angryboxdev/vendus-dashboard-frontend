import { describe, expect, it } from "vitest";
import type { InvoiceLineDTO, StoredAmountsDTO } from "../entities/invoice.ts";
import { restoreDraftHeader, restoreDraftLines } from "./stored-draft.ts";
import { payablesSummaryParams } from "./payables-summary.ts";
import { previewDetailed } from "./draft-amounts.ts";

const line = (over: Partial<InvoiceLineDTO> = {}): InvoiceLineDTO => ({
  id: "l1", invoiceId: "i1", description: "Mozzarella", type: "ingredient" as InvoiceLineDTO["type"],
  costCenterCategoryId: "c1", locationId: "L1", stockItemId: null, quantity: 20, unit: "kg",
  unitCostWithoutVat: 620, vatRate: 6, vatAmount: 670, totalWithVat: 11830, stockEntryId: null,
  affectsDre: true, affectsCashflow: true, affectsProfitability: true, financialType: null, channelId: null,
  requiresChannel: false, requiresAllocation: false, dreValue: 0, cashflowValue: 0,
  deductiblePercentage: null, deductibilityOverrideReason: null, createdAt: "2026-10-18T10:00:00Z", ...over,
});

const stored = (over: Partial<StoredAmountsDTO> = {}): StoredAmountsDTO => ({
  globalDiscountKind: null, globalDiscountValue: null, footerDiscountCents: null, adjustmentsCents: 0,
  roundingAdjustmentCents: 0, roundingAdjustmentReason: null, differenceCents: 0, lines: [], ...over,
});

describe("restoreDraftLines (reabrir rascunho)", () => {
  it("mantém subcategoria, loja, tipo, unidade e desconto % gravados", () => {
    const [l] = restoreDraftLines([line()], stored({ lines: [{ lineId: "l1", quantityText: null, unitPriceText: "6,20", discountKind: "pct", discountValue: 10 }] }));
    expect(l).toMatchObject({ key: "l1", catId: "c1", locationId: "L1", unit: "kg", type: "ingredient", quantity: "20", unitCost: "6.2", vatRate: "6", discountKind: "pct", discountValue: "10" });
  });

  it("preço com todas as casas do texto original; desconto em € passa a euros", () => {
    const [l] = restoreDraftLines([line({ unitCostWithoutVat: 124 })], stored({ lines: [{ lineId: "l1", quantityText: null, unitPriceText: "1,235", discountKind: "amount", discountValue: 250 }] }));
    expect(l).toMatchObject({ unitCost: "1.235", discountKind: "amount", discountValue: "2.50" });
  });

  it("sem valores gravados usa o preço da linha e nenhum desconto; nota de crédito em magnitude", () => {
    const [l] = restoreDraftLines([line({ quantity: -2, unitCostWithoutVat: -500, costCenterCategoryId: null })], null);
    expect(l).toMatchObject({ quantity: "2", unitCost: "5", discountValue: "", catId: "" });
  });
});

describe("restoreDraftHeader", () => {
  it("descontos globais, rodapé, ajustes e arredondamento gravados", () => {
    expect(restoreDraftHeader(stored({ globalDiscountKind: "amount", globalDiscountValue: 1000, footerDiscountCents: 1240, adjustmentsCents: -50, roundingAdjustmentCents: 1, roundingAdjustmentReason: "IVA por linha" })))
      .toEqual({ globalDiscountKind: "amount", globalDiscountValue: "10.00", footerDiscount: "12.40", adjustments: "-0.50", roundingReason: "IVA por linha", roundingOn: true });
  });
  it("sem valores gravados → null", () => {
    expect(restoreDraftHeader(null)).toBeNull();
  });
});

describe("payablesSummaryParams («Total a pagar | Em atraso»)", () => {
  it("mês → do dia 1 ao último dia, inclusive", () => {
    expect(payablesSummaryParams({ search: " makro ", month: "2026-02", supplierId: "s1" })).toEqual({ search: "makro", supplierId: "s1", from: "2026-02-01", to: "2026-02-28" });
    expect(payablesSummaryParams({ search: "", month: "2028-02", supplierId: "" })).toEqual({ from: "2028-02-01", to: "2028-02-29" });
  });
  it("sem filtros → sem parâmetros (todos os meses)", () => {
    expect(payablesSummaryParams({ search: "", month: null, supplierId: "" })).toEqual({});
  });
});

describe("editar fatura lançada (FT 61707 Dream Plus, 4 linhas com desconto)", () => {
  it("parte das linhas e descontos gravados: categoria mantida e diferença 0,00 € (antes −22,27 €)", () => {
    const rows: [string, number, number, number, number, number][] = [
      ["l1", 20, 620, 6, 670, 1240], ["l2", 7, 820, 6, 327, 287], ["l3", 1, 1559, 6, 89, 78], ["l4", 4, 1068, 23, 884, 427],
    ];
    const lines = rows.map(([id, q, u, v, va]) => line({ id, quantity: q, unitCostWithoutVat: u, vatRate: v, vatAmount: va, costCenterCategoryId: "cat-ingredientes" }));
    const restored = restoreDraftLines(lines, stored({ lines: rows.map(([id, , , , , d]) => ({ lineId: id, quantityText: null, unitPriceText: null, discountKind: "amount" as const, discountValue: d })) }));
    expect(restored.every((l) => l.catId === "cat-ingredientes")).toBe(true);
    const preview = previewDetailed(
      { totalStr: "239.09", subtotalStr: "219.39", vatStr: "19.70", globalDiscountKind: "pct", globalDiscountValue: "", footerDiscount: "", adjustments: "", roundingCents: 0, roundingReason: "", vatSummary: null },
      restored.map((l) => ({ key: l.key, quantity: l.quantity, unitCost: l.unitCost, vatRate: l.vatRate, discountKind: l.discountKind, discountValue: l.discountValue })),
    );
    expect(preview.differenceCents).toBe(0);
  });
});
