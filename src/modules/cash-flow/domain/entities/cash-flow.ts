/**
 * Fluxo de caixa do mês, só a partir do banco — contrato de `GET /api/reports/dre/fluxo-caixa`
 * (módulo backend `cash-flow`). Valores em cêntimos.
 */

export interface CashFlowPeriod {
  year: number;
  month: number;
  /** YYYY-MM-DD, primeiro dia do mês. */
  from: string;
  /** Último dia com dados: hoje no mês corrente, senão o fim do mês. */
  to: string;
  monthEnd: string;
  isCurrentMonth: boolean;
  /** Mesmos dias do mês anterior (ou o mês anterior inteiro, num mês fechado). */
  previous: { from: string; to: string };
}

export interface CashFlowDay {
  date: string;
  inflowCents: number;
  outflowCents: number;
}

export interface CashFlowTotals {
  inflowCents: number;
  outflowCents: number;
  netCents: number;
  /** Resultado ÷ entradas, em %; null sem entradas. */
  marginPct: number | null;
}

export interface CashFlowInflowKind {
  movementKind: string;
  amountCents: number;
  previousAmountCents: number;
}

export interface CashFlowCategoryChild {
  key: string;
  categoryId: string | null;
  code: string | null;
  name: string | null;
  amountCents: number;
  previousAmountCents: number;
}

export interface CashFlowCategory {
  key: string;
  /** «group»: centro de custo; «unclassified»: saída sem categoria, pelo tipo genérico do banco. */
  type: "group" | "unclassified";
  groupId: string | null;
  code: string | null;
  name: string | null;
  movementKind: string | null;
  amountCents: number;
  previousAmountCents: number;
  children: CashFlowCategoryChild[];
}

export interface CashFlowJustification {
  totalCents: number;
  justifiedCents: number;
  /** 0–100; null sem saídas. */
  percent: number | null;
  pendingCount: number;
}

export interface CashFlowReport {
  period: CashFlowPeriod;
  days: CashFlowDay[];
  previousDays: CashFlowDay[];
  totals: CashFlowTotals;
  previousTotals: CashFlowTotals;
  inflowKinds: CashFlowInflowKind[];
  categories: CashFlowCategory[];
  justification: CashFlowJustification;
}
