import { describe, expect, it } from "vitest";
import { buildRecurringRulePayload, canBeRecurring, recurringMatchPreview, suggestedRuleName } from "./recurring-rule.ts";

// Dados fictícios.
const movement = {
  description: "TARIFA MENSAL / COMPLEMENTAR 002995409",
  normalizedDescription: "Tarifa bancária",
  movementType: "debit" as const,
  amount: 1_230,
};

describe("recurring-rule", () => {
  it("only justifications without a per-month document can become a rule", () => {
    expect(canBeRecurring("despesa_bancaria_automatica")).toBe(true);
    expect(canBeRecurring("recibo_comprovativo")).toBe(true);
    expect(canBeRecurring("fatura")).toBe(false);
    expect(canBeRecurring("sem_justificativa")).toBe(false);
    expect(canBeRecurring("contrato_recorrencia")).toBe(false);
  });

  it("preview drops bank noise and words with digits (they change every month)", () => {
    expect(recurringMatchPreview("CREDITO TPA BCP 1234567 MOV N 92")).toBe("tpa bcp mov");
    expect(recurringMatchPreview("MDB9880 WWW.AMAZON* 70.24EUR")).toBe("www amazon");
  });

  it("suggests the readable description as the name", () => {
    expect(suggestedRuleName(movement)).toBe("Tarifa bancária");
    expect(suggestedRuleName({ description: "COMISSAO TPA" })).toBe("COMISSAO TPA");
  });

  it("builds the payload from the movement and the saved classification", () => {
    const payload = buildRecurringRulePayload(
      movement,
      "acc-1",
      { justificationType: "despesa_bancaria_automatica", costCenterGroupId: "g", costCenterCategoryId: "c", vatRate: 23, vatIncluded: true },
      { name: "  ", fixedAmount: false, applyToExisting: true },
    );
    expect(payload).toEqual({
      name: "Tarifa bancária",
      descriptionContains: "TARIFA MENSAL / COMPLEMENTAR 002995409",
      movementType: "debit",
      bankAccountId: "acc-1",
      justificationType: "despesa_bancaria_automatica",
      amountCents: null,
      costCenterGroupId: "g",
      costCenterCategoryId: "c",
      supplierId: null,
      vatRate: 23,
      vatIncluded: true,
      applyToExisting: true,
    });
  });

  it("fixed amount uses the movement's amount", () => {
    const payload = buildRecurringRulePayload(movement, "acc-1", { justificationType: "recibo_comprovativo" }, { name: "Renda", fixedAmount: true, applyToExisting: false });
    expect(payload.amountCents).toBe(1_230);
    expect(payload.name).toBe("Renda");
    expect(payload.applyToExisting).toBe(false);
  });
});

describe("buildRecurringRulePayload — regra ligada a uma recorrência", () => {
  it("leva a recorrência e a justificação «Contrato / Recorrência»", async () => {
    const { buildRecurringRulePayload } = await import("./recurring-rule.ts");
    const p = buildRecurringRulePayload(
      { description: "TRF P/ Senhorio Exemplo", normalizedDescription: "", movementType: "debit", amount: 40_000 },
      "acc-1",
      { justificationType: "contrato_recorrencia", costCenterGroupId: "g", costCenterCategoryId: "c" },
      { name: "Renda", fixedAmount: false, applyToExisting: true, recurrenceId: "rec-1" },
    );
    expect(p).toMatchObject({ justificationType: "contrato_recorrencia", recurrenceId: "rec-1", amountCents: null, bankAccountId: "acc-1" });
  });
});
