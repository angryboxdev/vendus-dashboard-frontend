import type { AccountMonthStatDTO } from "../entities/bank-statement.ts";

export interface AccountYearSummary {
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  importedMonths: number;
  /** Conciliação do ano = conciliados ÷ conciliáveis dos meses com extrato (não é a média das percentagens);
   *  `null` sem extrato ou sem nenhum movimento conciliável («Não aplicável», nunca 100%). */
  reconciledPercent: number | null;
  reconciledMovements: number;
  /** Conciliados ou só classificados (contam na rubrica certa da DRE); `null` como `reconciledPercent`. */
  classifiedPercent: number | null;
  reconcilableMovements: number;
  totalMovements: number;
  /** Saldo antes do 1.º movimento do primeiro mês importado / depois do último do último mês importado. */
  openingBalanceCents: number | null;
  closingBalanceCents: number | null;
}

/** Totais do ano só com os meses importados — nunca finge cobertura do ano inteiro (task V2 §7.2). */
export function summarizeYear(months: AccountMonthStatDTO[]): AccountYearSummary {
  const imported = months.filter((m) => m.statementImported).sort((a, b) => a.month - b.month);
  const reconcilable = imported.reduce((s, m) => s + m.reconcilableMovements, 0);
  const reconciled = imported.reduce((s, m) => s + m.reconciledMovements, 0);
  const classified = imported.reduce((s, m) => s + (m.classifiedMovements ?? m.reconciledMovements), 0);
  const withBalances = imported.filter((m) => m.openingBalanceCents !== null);
  const inflowCents = imported.reduce((s, m) => s + m.inflowCents, 0);
  const outflowCents = imported.reduce((s, m) => s + m.outflowCents, 0);
  return {
    inflowCents,
    outflowCents,
    netCents: inflowCents - outflowCents,
    importedMonths: imported.length,
    reconciledPercent: reconcilable === 0 ? null : Math.round((reconciled / reconcilable) * 100),
    reconciledMovements: reconciled,
    classifiedPercent: reconcilable === 0 ? null : Math.round((classified / reconcilable) * 100),
    reconcilableMovements: reconcilable,
    totalMovements: imported.reduce((s, m) => s + m.totalMovements, 0),
    openingBalanceCents: withBalances[0]?.openingBalanceCents ?? null,
    closingBalanceCents: withBalances[withBalances.length - 1]?.closingBalanceCents ?? null,
  };
}

/**
 * Conciliação de um mês para mostrar (task V3 §9.3): sem extrato não há percentagem; com extrato mas sem
 * movimentos conciliáveis é «Não aplicável» (nunca 100%); senão conciliados ÷ conciliáveis, com os
 * movimentos que ficam fora do denominador (entradas aceites automaticamente na importação).
 */
export type MonthReconciliation =
  | { kind: "no_statement" }
  | { kind: "not_applicable"; outside: number }
  | { kind: "percent"; percent: number; reconciled: number; reconcilable: number; outside: number };

export function monthReconciliation(stat: AccountMonthStatDTO | undefined): MonthReconciliation {
  if (!stat?.statementImported) return { kind: "no_statement" };
  const outside = stat.totalMovements - stat.reconcilableMovements;
  if (stat.reconcilableMovements === 0) return { kind: "not_applicable", outside };
  return {
    kind: "percent",
    percent: Math.round((stat.reconciledMovements / stat.reconcilableMovements) * 100),
    reconciled: stat.reconciledMovements,
    reconcilable: stat.reconcilableMovements,
    outside,
  };
}

export const MONTH_NAMES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const MONTH_SHORT_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

/** «2026-09-30» → «Set 2026». */
export function shortMonthLabel(isoDate: string): string {
  const [y, m] = isoDate.split("-").map(Number);
  return y && m ? `${MONTH_SHORT_PT[m - 1]} ${y}` : "—";
}

/** O mês importado mais recente do ano (para «Ver movimentos»); `null` sem nenhum. */
export function latestImportedMonth(months: AccountMonthStatDTO[]): number | null {
  const imported = months.filter((m) => m.statementImported && m.totalMovements > 0).map((m) => m.month);
  return imported.length ? Math.max(...imported) : null;
}

/** Mês anterior/seguinte, a passar de ano quando é preciso (dezembro → janeiro). */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
