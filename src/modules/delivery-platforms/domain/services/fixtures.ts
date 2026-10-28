import type { MarginReport, PlatformMargin } from "../entities/margin-report.ts";
import type { PayoutReconciliation } from "../entities/payout-reconciliation.ts";
import type { PlatformStatementSummary } from "../entities/platform-statement.ts";

const base = (over: Partial<PlatformStatementSummary>): PlatformStatementSummary => ({
  id: "s",
  platform: "uber_eats",
  documentKind: "uber_monthly_statement",
  documentNumber: "TESTE0001",
  periodFrom: "2026-09-01",
  periodTo: "2026-09-30",
  issuedOn: null,
  ordersCount: 0,
  salesCents: 0,
  salesVatCents: 0,
  promotionsCents: 0,
  commissionCents: 0,
  marketingCents: 0,
  otherFeesCents: 0,
  refundsCents: 0,
  cashCents: 0,
  adjustmentsCents: 0,
  feesVatCents: 0,
  netPayoutCents: 0,
  fileName: "extrato.pdf",
  importedAt: "2026-10-28T10:00:00Z",
  ...over,
});

/** Dados fictícios: um extrato mensal da Uber e duas quinzenas da Glovo (uma atravessa o mês). */
export const sampleStatements = (): PlatformStatementSummary[] => [
  base({
    id: "u1",
    documentNumber: "UBERTEST01",
    ordersCount: 100,
    salesCents: 200000,
    promotionsCents: 10000,
    commissionCents: 30000,
    marketingCents: 5000,
    otherFeesCents: 1000,
    netPayoutCents: 154000,
  }),
  base({
    id: "g1",
    platform: "glovo",
    documentKind: "glovo_statement",
    documentNumber: "GLOVOTEST01",
    periodFrom: "2026-08-25",
    periodTo: "2026-09-07",
    ordersCount: 20,
    salesCents: 60000,
    commissionCents: 20000,
    netPayoutCents: 40000,
  }),
  base({
    id: "g2",
    platform: "glovo",
    documentKind: "glovo_statement",
    documentNumber: "GLOVOTEST02",
    periodFrom: "2026-09-08",
    periodTo: "2026-09-21",
    ordersCount: 30,
    salesCents: 90000,
    commissionCents: 30000,
    cashCents: 2500,
    netPayoutCents: 50000,
  }),
];

/** Bolt (relatório de pedidos + uma fatura semanal) e o SAF-T do AirMenu do mês, fictícios. */
export const sampleBoltAndSaft = (): PlatformStatementSummary[] => [
  base({ id: "b1", platform: "bolt_food", documentKind: "bolt_orders_report", documentNumber: "PEDIDOS-2026-09-03-2026-09-30", ordersCount: 6, salesCents: 13000, netPayoutCents: 13000 }),
  base({ id: "b2", platform: "bolt_food", documentKind: "bolt_weekly_invoice", documentNumber: "PT9999-000001", periodFrom: "2026-09-21", periodTo: "2026-09-27", ordersCount: null, commissionCents: 2000, marketingCents: -1000, refundsCents: 500, netPayoutCents: -1500 }),
  base({ id: "s1", platform: "airmenu", documentKind: "airmenu_saft", documentNumber: "SAFT-2026-09-01-2026-09-30", ordersCount: 120, salesCents: 343000, salesVatCents: 39700, refundsCents: 0, netPayoutCents: 343000 }),
];

const margin = (platform: PlatformMargin["platform"], over: Partial<PlatformMargin> = {}): PlatformMargin => ({
  platform,
  documents: 1,
  ordersCount: 10,
  salesGrossCents: 11300,
  promotionsGrossCents: 1130,
  paidByCustomersCents: 10170,
  platformFeesGrossCents: 1945,
  feesVatCents: 345,
  commissionVatCents: 230,
  cashCents: 0,
  netPayoutCents: 8225,
  salesNetCents: 10000,
  promotionsNetCents: 1000,
  invoicedNetCents: 9000,
  salesVatCents: 1170,
  commissionNetCents: 1000,
  marketingNetCents: 500,
  otherNetCents: 100,
  grossMarginCents: 7400,
  grossMarginPct: 74,
  foodCostCents: 2700,
  netMarginCents: 4700,
  netMarginPct: 47,
  netMarginPerOrderCents: 470,
  vatToPayCents: 825,
  ...over,
});

/** Relatório fictício: só a Uber, SAF-T do mês que não bate e uma quinzena da Glovo repartida pelo SAF-T. */
export const sampleMarginReport = (): MarginReport => ({
  period: { year: 2026, month: 9, from: "2026-09-01", to: "2026-09-30" },
  salesVatRate: 0.1325,
  salesVatRateSource: "saft",
  foodCostPct: 30,
  platforms: [margin("uber_eats")],
  total: margin("total"),
  saft: { invoicedCents: 20000, platformsPaidCents: 10170, differenceCents: 9830 },
  documents: [
    { platform: "uber_eats", documentKind: "uber_monthly_statement", documentNumber: "UBERTEST01", periodFrom: "2026-09-01", periodTo: "2026-09-30", share: 1, basis: "month" },
    { platform: "glovo", documentKind: "glovo_statement", documentNumber: "GLOVOTEST01", periodFrom: "2026-08-25", periodTo: "2026-09-07", share: 0.75, basis: "saft" },
  ],
  warnings: ["Comida e embalagem estimadas em 30% do faturado sem IVA — o custo real virá das fichas técnicas."],
});

/** Conferência fictícia: uma semana da Uber que bate, uma quinzena da Glovo com diferença e outra por receber. */
export const samplePayouts = (): PayoutReconciliation => ({
  period: { year: 2026, month: 9, from: "2026-09-01", to: "2026-09-30" },
  bankCoverageTo: "2026-09-30",
  payouts: [
    { platform: "glovo", periodFrom: "2026-09-01", periodTo: "2026-09-15", paidOn: null, expectedCents: 30_000, dueBy: "2026-10-06", received: { creditId: "d", date: "2026-09-18", amountCents: 35_000 }, differenceCents: 5_000, status: "difference" },
    { platform: "glovo", periodFrom: "2026-09-16", periodTo: "2026-09-30", paidOn: null, expectedCents: 37_000, dueBy: "2026-10-21", received: null, differenceCents: null, status: "pending" },
    { platform: "uber_eats", periodFrom: "2026-09-07", periodTo: "2026-09-13", paidOn: "2026-09-14", expectedCents: 20_000, dueBy: "2026-10-04", received: { creditId: "b", date: "2026-09-14", amountCents: 20_000 }, differenceCents: 0, status: "ok" },
  ],
  totals: [
    { platform: "uber_eats", expectedCents: 20_000, receivedCents: 20_000, differenceCents: 0, pendingCents: 0 },
    { platform: "glovo", expectedCents: 67_000, receivedCents: 35_000, differenceCents: 5_000, pendingCents: 37_000 },
  ],
  unmatchedCredits: [{ id: "c", platform: "glovo", date: "2026-09-03", amountCents: 22_000 }],
  warnings: ["Banco importado só até 2026-09-30: as transferências devidas depois aparecem como por receber."],
});
