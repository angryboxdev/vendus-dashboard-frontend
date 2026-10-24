import { describe, expect, it } from "vitest";
import type { AiExtractedLineDTO, LineReadingMeta } from "../entities/invoice.ts";
import { readingForPayload, singleSuggestedCategory, suggestedDetailMode } from "./import-suggestions.ts";

const line = (cat: string | null): AiExtractedLineDTO => ({
  description: "x", quantity: 1, unitPriceWithoutVat: 100, vatRate: 23, vatAmount: null, totalWithoutVat: 100, totalWithVat: null, suggestedCostCenterCategoryId: cat,
});
const meta: LineReadingMeta = { supplierCode: "0012", page: 1, order: 0, kind: "product", vatCode: "2", promoCode: null, relatedOrder: null, notes: [], classificationSource: "keyword", classificationEvidence: "«LIXO» → limpeza." };

describe("sugestões do leitor na revisão", () => {
  it("categorias diferentes → «Por artigo»; iguais ou nenhuma → sem opinião", () => {
    expect(suggestedDetailMode([line("a"), line("b")])).toBe("detailed");
    expect(suggestedDetailMode([line("a"), line("a"), line(null)])).toBeNull();
    expect(suggestedDetailMode([])).toBeNull();
  });

  it("categoria única só quando todas as linhas têm a mesma sugestão", () => {
    expect(singleSuggestedCategory([line("a"), line("a")])).toBe("a");
    expect(singleSuggestedCategory([line("a"), line(null)])).toBeNull();
    expect(singleSuggestedCategory([line("a"), line("b")])).toBeNull();
  });

  it("mudar a sugestão marca a origem como manual; manter preserva a evidência", () => {
    expect(readingForPayload(meta, "c1", "c1")).toEqual(meta);
    expect(readingForPayload(meta, "c1", "c2")).toMatchObject({ supplierCode: "0012", classificationSource: "manual", classificationEvidence: null });
    expect(readingForPayload(undefined, null, "")).toBeUndefined();
  });
});
