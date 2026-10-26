import { describe, expect, it } from "vitest";
import type { BankStatementSummaryDTO } from "../entities/bank-statement.ts";
import { statementsOverview } from "./statement-overview.ts";

const s = (id: string, acc: string | null, end: string, count: number, closing: number, created: string): BankStatementSummaryDTO => ({
  id, bankAccountId: acc, bankName: "Banco Fictício", accountNumber: "1", periodStart: end.slice(0, 8) + "01", periodEnd: end, currency: "EUR", sourceType: "pdf",
  importedMovementsCount: count, openingBalance: 0, closingBalance: closing, calculatedClosingBalance: closing, balanceDifference: 0, reconciliationProgress: 0, status: "in_review", createdAt: created,
});

describe("statementsOverview", () => {
  it("último extrato por conta, importados este mês e última importação", () => {
    const o = statementsOverview(
      [s("1", "a", "2026-08-31", 120, 500, "2026-09-03T10:00:00Z"), s("2", "a", "2026-09-30", 139, 800, "2026-10-25T10:00:00Z"), s("3", "b", "2026-09-30", 80, -100, "2026-10-02T09:00:00Z"), s("4", null, "2026-09-30", 5, 0, "2026-10-26T08:00:00Z")],
      new Date("2026-10-26T12:00:00Z"),
    );
    expect(o.byAccount.get("a")).toEqual({ periodEnd: "2026-09-30", movementsCount: 139, closingBalanceCents: 800 });
    expect(o.byAccount.get("b")?.closingBalanceCents).toBe(-100);
    expect(o.importedThisMonth).toBe(3);
    expect(o.lastImportAt).toBe("2026-10-26T08:00:00Z");
  });

  it("sem extratos", () => {
    expect(statementsOverview([], new Date())).toMatchObject({ importedThisMonth: 0, lastImportAt: null });
  });
});
