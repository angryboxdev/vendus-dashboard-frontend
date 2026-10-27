/**
 * Conferência de vendas do mês — contrato de `GET /api/reports/dre/conferencia-vendas` (módulo backend
 * `cash-flow`): vendas do restaurante no Vendus × banco (cartão ↔ créditos TPA, numerário ↔ depósitos).
 * Tudo em cêntimos.
 */

/** Um crédito TPA e os dias de venda que cobre (do crédito anterior até à véspera deste). */
export interface CardSettlement {
  creditDate: string;
  salesFrom: string;
  salesTo: string;
  soldCents: number;
  receivedCents: number;
  differenceCents: number;
  impliedFeePct: number | null;
  /** ok = taxa dentro da tolerância; check = fora; no_sales = crédito sem vendas no Vendus. */
  status: "ok" | "check" | "no_sales";
}

export interface CashDeposit {
  date: string;
  depositedCents: number;
  soldSincePreviousCents: number;
}

export interface SalesReconciliationDay {
  date: string;
  cardSoldCents: number;
  cardReceivedCents: number;
  cashSoldCents: number;
  cashDepositedCents: number;
}

export interface SalesReconciliation {
  period: { year: number; month: number; from: string; to: string; isCurrentMonth: boolean };
  expectedCardFeePct: number;
  feeTolerancePct: number;
  card: {
    soldCents: number;
    receivedCents: number;
    settledSoldCents: number;
    differenceCents: number;
    impliedFeePct: number | null;
    expectedFeeCents: number;
    settlements: CardSettlement[];
    pending: { from: string; to: string; soldCents: number } | null;
  };
  cash: {
    soldCents: number;
    depositedCents: number;
    notDepositedCents: number;
    deposits: CashDeposit[];
  };
  days: SalesReconciliationDay[];
}
