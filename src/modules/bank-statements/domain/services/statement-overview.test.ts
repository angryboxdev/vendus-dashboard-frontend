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

describe("extratos do mês e saldos validados", () => {
  // Dados fictícios.
  const st = (id: string, start: string, end: string, opening: number, closing: number, diff = 0, acc = "a"): BankStatementSummaryDTO => ({
    id, bankAccountId: acc, bankName: "Banco Fictício", accountNumber: "1", periodStart: `${start}T00:00:00.000Z`, periodEnd: `${end}T00:00:00.000Z`,
    currency: "EUR", sourceType: "pdf", importedMovementsCount: 10, openingBalance: opening, closingBalance: closing,
    calculatedClosingBalance: closing + diff, balanceDifference: diff, reconciliationProgress: 0, status: "in_review", createdAt: "2026-10-01T00:00:00Z",
  });

  it("extratos que tocam o mês, só da conta, por data", async () => {
    const { statementsOfMonth } = await import("./statement-overview.ts");
    const list = [st("sep2", "2026-09-15", "2026-09-30", 0, 0), st("aug", "2026-08-01", "2026-08-31", 0, 0), st("sep1", "2026-08-20", "2026-09-14", 0, 0), st("other", "2026-09-01", "2026-09-30", 0, 0, 0, "b")];
    expect(statementsOfMonth(list, "a", 2026, 9).map((s) => s.id)).toEqual(["sep1", "sep2"]);
  });

  it("saldo inicial/final do mês só do extrato que bate certo e cobre o início/fim", async () => {
    const { monthStatementBalances } = await import("./statement-overview.ts");
    expect(monthStatementBalances([st("sep", "2026-09-01", "2026-09-30", 494_996, 562_646)], "a", 2026, 9)).toEqual({ openingCents: 494_996, closingCents: 562_646 });
    // extrato que não bate certo (diferença ≠ 0): nada
    expect(monthStatementBalances([st("sep", "2026-09-01", "2026-09-30", 10_000, 68_104, 500)], "a", 2026, 9)).toEqual({ openingCents: null, closingCents: null });
    // só a segunda quinzena: há saldo final mas não inicial
    expect(monthStatementBalances([st("sep", "2026-09-15", "2026-09-30", 1, 2)], "a", 2026, 9)).toEqual({ openingCents: null, closingCents: 2 });
  });

  it("último saldo conhecido = extrato mais recente que bate certo", async () => {
    const { lastKnownBalance } = await import("./statement-overview.ts");
    const list = [st("aug", "2026-08-01", "2026-08-31", 0, 494_996), st("sep", "2026-09-01", "2026-09-30", 0, 1, 99)];
    expect(lastKnownBalance(list, "a")).toEqual({ cents: 494_996, date: "2026-08-31" });
    expect(lastKnownBalance([], "a")).toBeNull();
  });
});
