import type { ResolvedDreParameters } from "../entities/dre.ts";
import type { SalesReconciliation } from "../entities/sales-reconciliation.ts";

/** Conferência fictícia (setembro, mês fechado) para os testes. */
export function sampleReconciliation(): SalesReconciliation {
  return {
    period: { year: 2026, month: 9, from: "2026-09-01", to: "2026-09-30", isCurrentMonth: false },
    expectedCardFeePct: 1,
    feeTolerancePct: 0.5,
    card: {
      soldCents: 70_000,
      receivedCents: 59_100,
      settledSoldCents: 60_000,
      differenceCents: 900,
      impliedFeePct: 1.5,
      expectedFeeCents: 600,
      settlements: [
        { creditDate: "2026-09-07", salesFrom: "2026-09-04", salesTo: "2026-09-06", soldCents: 30_000, receivedCents: 29_700, differenceCents: 300, impliedFeePct: 1, status: "ok" },
        { creditDate: "2026-09-08", salesFrom: "2026-09-07", salesTo: "2026-09-07", soldCents: 30_000, receivedCents: 29_400, differenceCents: 600, impliedFeePct: 2, status: "check" },
      ],
      pending: { from: "2026-09-29", to: "2026-09-30", soldCents: 10_000 },
    },
    cash: {
      soldCents: 13_000,
      depositedCents: 10_000,
      notDepositedCents: 3_000,
      deposits: [{ date: "2026-09-03", depositedCents: 10_000, soldSincePreviousCents: 10_000 }],
    },
    days: [],
  };
}

/** Parâmetros fictícios (valores de omissão). */
export function sampleParameters(): ResolvedDreParameters {
  return {
    deliverySalesVatPct: 15,
    platformCommissionPct: 30,
    platformCommissionVatPct: 23,
    commissionOnGross: true,
    marketingVatPct: 23,
    cardFeePct: 1,
    expenseDefaultVatPct: 23,
    marketingNetCents: { uber_eats: 0, glovo: 0, bolt_food: 0 },
    loanExpenseCents: 0,
    source: "default",
  };
}
