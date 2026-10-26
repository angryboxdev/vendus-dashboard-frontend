import type { BankStatementSummaryDTO } from "../entities/bank-statement.ts";

export interface AccountLastStatement {
  /** Fim do período do extrato mais recente (YYYY-MM-DD). */
  periodEnd: string;
  movementsCount: number;
  /** Saldo final desse extrato (cêntimos). */
  closingBalanceCents: number;
}

export interface StatementsOverview {
  byAccount: Map<string, AccountLastStatement>;
  importedThisMonth: number;
  /** Data (ISO) da importação mais recente; `null` sem nenhuma. */
  lastImportAt: string | null;
}

/** Último extrato de cada conta + indicadores da página Bancos (extratos importados este mês, última importação). */
export function statementsOverview(statements: BankStatementSummaryDTO[], today: Date): StatementsOverview {
  const byAccount = new Map<string, AccountLastStatement>();
  for (const s of statements) {
    if (!s.bankAccountId) continue;
    const cur = byAccount.get(s.bankAccountId);
    if (!cur || s.periodEnd > cur.periodEnd) {
      byAccount.set(s.bankAccountId, { periodEnd: s.periodEnd.slice(0, 10), movementsCount: s.importedMovementsCount, closingBalanceCents: s.closingBalance });
    }
  }
  const month = today.toISOString().slice(0, 7);
  const created = statements.map((s) => s.createdAt).sort();
  return {
    byAccount,
    importedThisMonth: statements.filter((s) => s.createdAt.slice(0, 7) === month).length,
    lastImportAt: created[created.length - 1] ?? null,
  };
}
