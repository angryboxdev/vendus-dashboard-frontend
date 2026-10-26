import type { AccountMonthStatDTO } from "../entities/bank-statement.ts";

export interface AccountYearSummary {
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  importedMonths: number;
  /** Conciliação do ano sobre os movimentos conciliáveis dos meses com extrato; `null` sem nenhum. */
  reconciledPercent: number | null;
  /** Saldo antes do 1.º movimento do primeiro mês importado / depois do último do último mês importado. */
  openingBalanceCents: number | null;
  closingBalanceCents: number | null;
}

/** Totais do ano só com os meses importados — nunca finge cobertura do ano inteiro (task V2 §7.2). */
export function summarizeYear(months: AccountMonthStatDTO[]): AccountYearSummary {
  const imported = months.filter((m) => m.statementImported).sort((a, b) => a.month - b.month);
  const reconcilable = imported.reduce((s, m) => s + m.reconcilableMovements, 0);
  const reconciled = imported.reduce((s, m) => s + m.reconciledMovements, 0);
  const withBalances = imported.filter((m) => m.openingBalanceCents !== null);
  const inflowCents = imported.reduce((s, m) => s + m.inflowCents, 0);
  const outflowCents = imported.reduce((s, m) => s + m.outflowCents, 0);
  return {
    inflowCents,
    outflowCents,
    netCents: inflowCents - outflowCents,
    importedMonths: imported.length,
    reconciledPercent: imported.some((m) => m.totalMovements > 0) ? (reconcilable === 0 ? 100 : Math.round((reconciled / reconcilable) * 100)) : null,
    openingBalanceCents: withBalances[0]?.openingBalanceCents ?? null,
    closingBalanceCents: withBalances[withBalances.length - 1]?.closingBalanceCents ?? null,
  };
}
