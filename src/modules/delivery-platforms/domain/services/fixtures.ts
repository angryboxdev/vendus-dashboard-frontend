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
