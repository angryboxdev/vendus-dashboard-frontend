import { describe, expect, it } from "vitest";
import { parseEuroToCents } from "../../../bank-statements/domain/services/recurring-rules-overview.ts";
import { fromForm, parsePct, pctLabel, salesRangeLabel, toForm } from "./sales-reconciliation-view.ts";
import { sampleParameters } from "./sales-reconciliation-fixtures.ts";

describe("sales-reconciliation-view", () => {
  it("intervalo de dias e percentagens em português", () => {
    expect(salesRangeLabel("2026-09-04", "2026-09-06")).toBe("04/09 – 06/09");
    expect(salesRangeLabel("2026-09-07", "2026-09-07")).toBe("07/09");
    expect(pctLabel(1.5)).toBe("1,5%");
    expect(pctLabel(null)).toBe("—");
  });

  it("percentagens escritas à mão", () => {
    expect(parsePct("15")).toBe(15);
    expect(parsePct("12,5 %")).toBe(12.5);
    expect(parsePct("101")).toBeNull();
    expect(parsePct("abc")).toBeNull();
  });

  it("formulário ida e volta; marketing em euros → cêntimos; vazio = 0", () => {
    const form = toForm(sampleParameters());
    expect(form.pct.deliverySalesVatPct).toBe("15");
    const edited = { ...form, pct: { ...form.pct, deliverySalesVatPct: "14,5" }, marketing: { uber_eats: "120,50", glovo: "", bolt_food: "0" } };
    expect(fromForm(edited, parseEuroToCents)).toEqual({
      ok: true,
      value: { ...sampleParameters(), source: undefined, deliverySalesVatPct: 14.5, marketingNetCents: { uber_eats: 12_050, glovo: 0, bolt_food: 0 } },
    });
  });

  it("lista os campos inválidos", () => {
    const form = toForm(sampleParameters());
    const r = fromForm({ ...form, pct: { ...form.pct, cardFeePct: "x" }, marketing: { ...form.marketing, glovo: "-3" } }, parseEuroToCents);
    expect(r).toEqual({ ok: false, invalid: ["cardFeePct", "marketing.glovo"] });
  });
});
