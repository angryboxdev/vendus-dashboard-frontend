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
    expect(s).toEqual({
      inflowCents: 1_000, outflowCents: 900, netCents: 100, importedMonths: 2, reconciledPercent: 40,
      reconciledMovements: 4, reconcilableMovements: 10, totalMovements: 14, openingBalanceCents: 1_000, closingBalanceCents: 1_100,
    });
  });

  it("% do ano = conciliados ÷ conciliáveis (não a média das percentagens mensais)", () => {
    // Regressão da task V3: 4 meses com denominadores diferentes.
    const s = summarizeYear([
      month(6, { statementImported: true, totalMovements: 115, reconcilableMovements: 70, reconciledMovements: 57, inflowCents: 1_397_381, outflowCents: 1_940_807 }),
      month(7, { statementImported: true, totalMovements: 125, reconcilableMovements: 80, reconciledMovements: 49, inflowCents: 2_375_415, outflowCents: 2_361_367 }),
      month(8, { statementImported: true, totalMovements: 123, reconcilableMovements: 78, reconciledMovements: 54, inflowCents: 1_691_766, outflowCents: 1_986_808 }),
      month(9, { statementImported: true, totalMovements: 139, reconcilableMovements: 91, reconciledMovements: 32, inflowCents: 1_651_653, outflowCents: 1_593_549 }),
    ]);
    expect(s.reconciledPercent).toBe(60); // 192 ÷ 319; a média simples (81+61+69+35)/4 daria 62
    expect(s.inflowCents).toBe(7_116_215);
    expect(s.outflowCents).toBe(7_882_531);
    expect(s.netCents).toBe(-766_316);
    expect(s.totalMovements).toBe(502);
  });

  it("com extrato mas sem nada para conciliar: «Não aplicável» (null), nunca 100%", () => {
    const s = summarizeYear([month(9, { statementImported: true, totalMovements: 5, reconcilableMovements: 0, reconciledMovements: 0 })]);
    expect(s.reconciledPercent).toBeNull();
  });
});

describe("monthReconciliation", () => {
  it("sem extrato / não aplicável / percentagem com o que fica fora do denominador", async () => {
    const { monthReconciliation } = await import("./account-year.ts");
    expect(monthReconciliation(month(10))).toEqual({ kind: "no_statement" });
    expect(monthReconciliation(month(9, { statementImported: true, totalMovements: 3, reconcilableMovements: 0 }))).toEqual({ kind: "not_applicable", outside: 3 });
    expect(monthReconciliation(month(9, { statementImported: true, totalMovements: 139, reconcilableMovements: 91, reconciledMovements: 32 }))).toEqual({
      kind: "percent", percent: 35, reconciled: 32, reconcilable: 91, outside: 48,
    });
  });
});

describe("shiftMonth", () => {
  it("anda um mês e passa de ano nos dois sentidos", async () => {
    const { shiftMonth } = await import("./account-year.ts");
    expect(shiftMonth(2026, 10, 1)).toEqual({ year: 2026, month: 11 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  });
});
