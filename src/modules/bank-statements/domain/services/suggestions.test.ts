import { describe, expect, it } from "vitest";
import { isStrongCandidate } from "./suggestions.ts";

describe("isStrongCandidate", () => {
  it("needs name, amount and ≥ 70%", () => {
    expect(isStrongCandidate({ confidence: 0.8, nameMatched: true, amountMatched: true })).toBe(true);
    expect(isStrongCandidate({ confidence: 0.69, nameMatched: true, amountMatched: true })).toBe(false);
    expect(isStrongCandidate({ confidence: 0.95, nameMatched: false, amountMatched: true })).toBe(false);
    expect(isStrongCandidate({ confidence: 0.95, nameMatched: true, amountMatched: false })).toBe(false);
  });

  it("older API without the flags never counts as a suggestion", () => {
    expect(isStrongCandidate({ confidence: 1 })).toBe(false);
  });
});

describe("bulkReconcileItems", () => {
  it("um pedido por sugestão, com o saldo em aberto limitado ao valor do movimento; ignora movimentos fora do mês", async () => {
    const { bulkReconcileItems } = await import("./suggestions.ts");
    const items = bulkReconcileItems(
      [
        { movementId: "m1", entityType: "invoice", entityId: "i1", openBalanceCents: 21_047, supplierId: "s1" },
        { movementId: "m2", entityType: "invoice", entityId: "i2", openBalanceCents: 50_000, supplierId: null },
        { movementId: "fora", entityType: "payable_entry", entityId: "p1", openBalanceCents: 100, supplierId: null },
      ],
      new Map([["m1", 21_047], ["m2", 36_777]]),
    );
    expect(items).toEqual([
      { movementId: "m1", amountCents: 21_047, entityLinks: [{ entityType: "invoice", entityId: "i1", allocatedAmountCents: 21_047, supplierId: "s1" }] },
      { movementId: "m2", amountCents: 36_777, entityLinks: [{ entityType: "invoice", entityId: "i2", allocatedAmountCents: 36_777, supplierId: null }] },
    ]);
  });
});
