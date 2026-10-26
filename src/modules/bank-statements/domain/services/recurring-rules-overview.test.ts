import { describe, expect, it } from "vitest";
import type { ReconciliationRuleDTO } from "../entities/bank-statement.ts";
import { filterRules, groupRulesByAccount, parseEuroToCents, ruleAmountLabel, summarizeRules } from "./recurring-rules-overview.ts";

// Dados fictícios.
function rule(over: Partial<ReconciliationRuleDTO>): ReconciliationRuleDTO {
  return {
    id: "r",
    name: "Regra",
    descriptionContains: "TEXTO",
    movementType: "debit",
    bankAccountId: "a1",
    amountCents: null,
    amountToleranceCents: 100,
    costCenterGroupId: null,
    costCenterCategoryId: null,
    supplierId: null,
    vatRate: null,
    vatIncluded: null,
    justificationType: "despesa_bancaria_automatica",
    requiresDocument: false,
    riskLevel: "low",
    isActive: true,
    createdAt: "2026-09-01",
    ...over,
  };
}

const rules = [
  rule({ id: "1", name: "Comissão TPA", descriptionContains: "COMISSAO TPA", usage: { movementsCount: 12, lastBookingDate: "2026-09-30" } }),
  rule({ id: "2", name: "Tarifa mensal", descriptionContains: "TARIFA MENSAL", isActive: false, usage: { movementsCount: 3, lastBookingDate: "2026-06-01" } }),
  rule({ id: "3", name: "Renda", descriptionContains: "TRF P/ Senhorio", bankAccountId: "a2", amountCents: 120_000, usage: { movementsCount: 1, lastBookingDate: null } }),
  rule({ id: "4", name: "Antiga", bankAccountId: null }),
];

describe("recurring-rules-overview", () => {
  it("summarizes active, paused and auto-reconciled movements", () => {
    expect(summarizeRules(rules)).toEqual({ active: 3, paused: 1, autoMovements: 16 });
  });

  it("filters by status, account and search (accent-insensitive)", () => {
    expect(filterRules(rules, { status: "active", accountId: null, search: "" }).map((r) => r.id)).toEqual(["1", "3", "4"]);
    expect(filterRules(rules, { status: "paused", accountId: null, search: "" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterRules(rules, { status: "all", accountId: "a2", search: "" }).map((r) => r.id)).toEqual(["3"]);
    expect(filterRules(rules, { status: "all", accountId: null, search: "comissao" }).map((r) => r.id)).toEqual(["1"]);
    expect(filterRules(rules, { status: "all", accountId: null, search: "senhorio" }).map((r) => r.id)).toEqual(["3"]);
  });

  it("groups by account (rules without account last), active and most used first", () => {
    const groups = groupRulesByAccount(rules, (id) => (id === "a1" ? "Millennium · Conta principal" : "CGD · Conta"));
    expect(groups.map((g) => g.label)).toEqual(["CGD · Conta", "Millennium · Conta principal", "Todas as contas"]);
    expect(groups[1]!.rules.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("labels the amount", () => {
    const eur = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
    expect(ruleAmountLabel({ amountCents: null, amountToleranceCents: 100 }, eur)).toBe("Qualquer valor");
    expect(ruleAmountLabel({ amountCents: 1_230, amountToleranceCents: 100 }, eur)).toBe("12,30 € ± 1,00 €");
  });

  it("parses euro amounts typed by the user", () => {
    expect(parseEuroToCents("18,74")).toBe(1_874);
    expect(parseEuroToCents("1 230,50 €")).toBe(123_050);
    expect(parseEuroToCents("1.230,5")).toBe(123_050);
    expect(parseEuroToCents("12.3")).toBe(1_230);
    expect(parseEuroToCents("abc")).toBeNull();
    expect(parseEuroToCents("")).toBeNull();
    expect(parseEuroToCents("-5")).toBeNull();
  });
});
