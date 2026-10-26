import { describe, expect, it } from "vitest";
import type { AccountMonthStatDTO } from "../entities/bank-statement.ts";
import { summarizeYear } from "./account-year.ts";

const month = (n: number, over: Partial<AccountMonthStatDTO> = {}): AccountMonthStatDTO => ({
  year: 2026, month: n, statementImported: false, status: "no_statement", totalMovements: 0, reconcilableMovements: 0, reconciledMovements: 0,
  reconciledPercent: null, inflowCents: 0, outflowCents: 0, netCents: 0, openingBalanceCents: null, closingBalanceCents: null,
  salesReconciledPercent: 100, expensesReconciledPercent: 100, totalCreditCents: 0, totalDebitCents: 0, balanceCents: 0, ...over,
});

describe("summarizeYear", () => {
  it("sem meses importados: zeros e sem percentagem", () => {
    expect(summarizeYear([1, 2, 3].map((n) => month(n)))).toMatchObject({ importedMonths: 0, reconciledPercent: null, openingBalanceCents: null });
  });

  it("soma só os meses importados; % sobre os conciliáveis; saldos do 1.º e do último mês", () => {
    const s = summarizeYear([
      month(1),
      month(9, { statementImported: true, status: "partial", totalMovements: 10, reconcilableMovements: 8, reconciledMovements: 2, inflowCents: 900, outflowCents: 600, openingBalanceCents: 1_000, closingBalanceCents: 1_300 }),
      month(10, { statementImported: true, status: "reconciled", totalMovements: 4, reconcilableMovements: 2, reconciledMovements: 2, inflowCents: 100, outflowCents: 300, openingBalanceCents: 1_300, closingBalanceCents: 1_100 }),
    ]);
    expect(s).toEqual({ inflowCents: 1_000, outflowCents: 900, netCents: 100, importedMonths: 2, reconciledPercent: 40, openingBalanceCents: 1_000, closingBalanceCents: 1_100 });
  });
});
