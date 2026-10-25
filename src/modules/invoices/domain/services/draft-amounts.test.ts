import { describe, expect, test } from "vitest";
import { amountsPayload, discountOf, docPriceToField, docQuantityToField, lineValueFields, parseTyped, previewDetailed, previewSimple, toServerText, typedToCents, type DraftAmountHeader, type DraftAmountLine } from "./draft-amounts.ts";

const header = (over: Partial<DraftAmountHeader> = {}): DraftAmountHeader => ({
  totalStr: "118.30", subtotalStr: "111.60", vatStr: "6.70",
  globalDiscountKind: "pct", globalDiscountValue: "", footerDiscount: "", adjustments: "",
  roundingCents: 0, roundingReason: "", vatSummary: null, ...over,
});
const mozzarella: DraftAmountLine = { key: "l1", quantity: "20", unitCost: "6.20", vatRate: "6", discountKind: "pct", discountValue: "10" };

describe("draft-amounts (formulário → motor único)", () => {
  test("números escritos: vírgula ou ponto, sem float", () => {
    expect(typedToCents("118,30")).toBe(11830);
    expect(typedToCents("0.1")).toBe(10);
    expect(typedToCents("1.234,56")).toBeNull();
    expect(parseTyped("abc")).toBeNull();
    expect(toServerText("1.235")).toBe("1,235");
  });

  test("Mozzarella: bruto 124,00, desconto 12,40, base 111,60, IVA 6,70, total 118,30, diferença 0", () => {
    const r = previewDetailed(header(), [mozzarella]);
    expect([r.grossCents, r.discountCents, r.netCents, r.vatCents, r.totalCents, r.finalDifferenceCents]).toEqual([12400, 1240, 11160, 670, 11830, 0]);
    expect(r.canFinalize).toBe(true);
    expect(lineValueFields(mozzarella, r)).toEqual({ quantity: 20, unitCostWithoutVat: 620, vatRate: 6, vatAmount: 670, totalWithVat: 11830, unitPriceText: "6,2", discount: { kind: "pct", value: 10 } });
  });

  test("desconto em € igual ao de %", () => {
    expect(previewDetailed(header(), [{ ...mozzarella, discountKind: "amount", discountValue: "12,40" }]).netCents).toBe(11160);
    expect(discountOf("amount", "12,40")).toEqual({ kind: "amount", value: 1240 });
    expect(discountOf("pct", "")).toBeNull();
  });

  test("taxa de IVA por validar bloqueia (nunca 0%)", () => {
    const r = previewDetailed(header(), [{ ...mozzarella, vatRate: "" }]);
    expect(r.canFinalize).toBe(false);
    expect(r.blocking.map((i) => i.code)).toContain("vat_rate_missing");
  });

  test("preço com 3 casas não perde precisão", () => {
    const r = previewDetailed(header({ totalStr: "26.18" }), [{ key: "a", quantity: "20", unitCost: "1.235", vatRate: "6", discountKind: "pct", discountValue: "" }]);
    expect(r.grossCents).toBe(2470);
    expect(r.finalDifferenceCents).toBe(0);
  });

  test("valores extraídos: preço do texto do documento e quantidade ambígua resolvida pelo bruto", () => {
    expect(docPriceToField("1,235", 124)).toBe("1.235");
    expect(docPriceToField(null, 620)).toBe("6.2");
    expect(docQuantityToField("20.000", 20000, "1.235", 2470)).toBe("20");
    expect(docQuantityToField("20.000", 20000, "1.235", null)).toBe("20000");
  });

  test("CPF/2530: sem preço unitário, o preço é derivado do total da linha e não multiplica de novo", () => {
    // 4 unidades, total da linha 190,00 € → 47,50 € (4 × 47,50 = 190,00, nunca 4 × 190,00).
    expect(docPriceToField(null, null, { totalCents: 19000, quantity: 4 })).toBe("47.50");
    // Divisão não exata mantém casas suficientes para fechar ao cêntimo (3 × 33,333333 = 100,00).
    expect(docPriceToField(null, null, { totalCents: 10000, quantity: 3 })).toBe("33.333333");
  });

  test("modo simples e payload de valores", () => {
    expect(previewSimple(header()).canFinalize).toBe(true);
    expect(previewSimple(header({ totalStr: "119.00" })).differenceCents).toBe(70);
    expect(amountsPayload(header({ globalDiscountValue: "5", roundingCents: 1, roundingReason: "Arredondamento do fornecedor" }), true)).toEqual({
      globalDiscount: { kind: "pct", value: 5 }, footerDiscountCents: null, adjustmentsCents: 0, roundingAdjustment: { cents: 1, reason: "Arredondamento do fornecedor" },
    });
    expect(amountsPayload(header(), false)).toEqual({ adjustmentsCents: 0 });
  });
});

describe("docQuantityToField — Dream Plus FT 56892", () => {
  it("«4,000» sem bruto impresso = 4 (não 4000); «20,000» = 20; validado pelo bruto continua a decidir", () => {
    expect(docQuantityToField("4,000", 4000, "10,68", null)).toBe("4");
    expect(docQuantityToField("20,000", 20000, "6,20", undefined)).toBe("20");
    expect(docQuantityToField("4,000", 4000, "10,68", 4272)).toBe("4");
  });
});
