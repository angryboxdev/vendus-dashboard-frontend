import { describe, expect, it } from "vitest";
import type { StockRoutingSuggestion } from "../entities/invoice.ts";
import { initialStockChoice, stockDecision, stockRoutingInput } from "./stock-decision.ts";

const send: StockRoutingSuggestion = { send: true, source: "supplier", reason: "Fornecedor: enviar por defeito", requiresDecision: false };
const skip: StockRoutingSuggestion = { send: false, source: "category", reason: "Energia", requiresDecision: false };
const decide: StockRoutingSuggestion = { send: null, source: "supplier", reason: "Decidir no documento", requiresDecision: true };

describe("stockDecision («Enviar para Stock»)", () => {
  it("sem escolha segue a sugestão e envia «auto» ao servidor", () => {
    expect(stockDecision(send, null, "")).toMatchObject({ checked: true, override: "auto", blocking: null });
    expect(stockDecision(skip, null, "")).toMatchObject({ checked: false, override: "auto", blocking: null });
  });

  it("«Decidir no documento» sem escolha bloqueia — ausência de decisão não é «Não enviar»", () => {
    expect(stockDecision(decide, null, "").blocking).toMatch(/Indique se/);
    expect(stockDecision(decide, false, "")).toMatchObject({ override: "force_skip", blocking: null, contrary: false });
    expect(stockDecision(decide, true, "")).toMatchObject({ override: "force_create", blocking: null });
  });

  it("desmarcar contra a predefinição «Enviar» exige motivo", () => {
    expect(stockDecision(send, false, "  ")).toMatchObject({ contrary: true, blocking: expect.stringMatching(/motivo/) });
    expect(stockDecision(send, false, " devolução ")).toMatchObject({ override: "force_skip", overrideReason: "devolução", blocking: null });
  });

  it("marcar contra a predefinição «Não enviar» não exige motivo", () => {
    expect(stockDecision(skip, true, "")).toMatchObject({ checked: true, override: "force_create", overrideReason: null, blocking: null });
  });

  it("sem sugestão (a carregar ou sem sinal) não bloqueia", () => {
    expect(stockDecision(null, null, "")).toMatchObject({ checked: false, override: "auto", blocking: null });
  });

  it("escolha inicial vem do que está gravado", () => {
    expect(initialStockChoice("force_create")).toBe(true);
    expect(initialStockChoice("force_skip")).toBe(false);
    expect(initialStockChoice("auto")).toBeNull();
    expect(initialStockChoice(undefined)).toBeNull();
  });
});

describe("stockRoutingInput (mesma regra do servidor)", () => {
  it("uma só loja nas linhas → essa loja", () => {
    expect(stockRoutingInput([{ locationId: "L1", categoryId: "c2" }, { locationId: "L1", categoryId: "c1" }], null, "L9"))
      .toEqual({ locationId: "L1", categoryIds: ["c1", "c2"] });
  });
  it("sem loja nas linhas → destino habitual do fornecedor; várias → nenhuma", () => {
    expect(stockRoutingInput([{ locationId: null, categoryId: null }], "h1", "L9")).toEqual({ locationId: "L9", categoryIds: ["h1"] });
    expect(stockRoutingInput([{ locationId: "L1", categoryId: null }, { locationId: "L2", categoryId: null }], null, "L9").locationId).toBeNull();
  });
});
