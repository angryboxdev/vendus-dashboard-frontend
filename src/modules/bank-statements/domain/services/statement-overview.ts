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

const day = (iso: string) => iso.slice(0, 10);
const monthBounds = (year: number, month: number) => {
  const mm = String(month).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { first: `${year}-${mm}-01`, last: `${year}-${mm}-${String(last).padStart(2, "0")}` };
};

/** Extratos de uma conta que tocam o mês (para os mostrar e eliminar no resumo do mês), por data de início. */
export function statementsOfMonth(statements: BankStatementSummaryDTO[], accountId: string, year: number, month: number): BankStatementSummaryDTO[] {
  const { first, last } = monthBounds(year, month);
  return statements
    .filter((s) => s.bankAccountId === accountId && day(s.periodStart) <= last && day(s.periodEnd) >= first)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart));
}

/** Um extrato «bate certo» quando o saldo final calculado pelos movimentos é o saldo final do banco. */
const validated = (s: BankStatementSummaryDTO) => s.balanceDifference === 0;

/**
 * Saldo no início e no fim do mês, tirados do próprio extrato (SALDO INICIAL/FINAL) — e só de extratos que
 * batem certo: o inicial de um que começa no dia 1, o final de um que acaba no último dia. Senão `null`
 * (nunca um saldo reconstruído a partir dos movimentos, que pode estar errado).
 */
export function monthStatementBalances(
  statements: BankStatementSummaryDTO[],
  accountId: string,
  year: number,
  month: number,
): { openingCents: number | null; closingCents: number | null } {
  const { first, last } = monthBounds(year, month);
  const ofMonth = statementsOfMonth(statements, accountId, year, month).filter(validated);
  return {
    openingCents: ofMonth.find((s) => day(s.periodStart) === first)?.openingBalance ?? null,
    closingCents: ofMonth.find((s) => day(s.periodEnd) === last)?.closingBalance ?? null,
  };
}

/** Último saldo conhecido da conta: o saldo final do extrato mais recente que bate certo, com a data. */
export function lastKnownBalance(statements: BankStatementSummaryDTO[], accountId: string): { cents: number; date: string } | null {
  const best = statements
    .filter((s) => s.bankAccountId === accountId && validated(s))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0];
  return best ? { cents: best.closingBalance, date: day(best.periodEnd) } : null;
}
