import type { DreEntries, DreReport, DreRestaurantSales } from "../entities/dre.ts";

/** DRE rápida fictícia (março, mês fechado): custos do banco e plataformas, sem o restaurante. */
export function sampleDre(): DreReport {
  return {
    period: { year: 2026, month: 3, from: "2026-03-01", to: "2026-03-31", isCurrentMonth: false },
    restaurantSalesLoaded: false,
    parameters: {
      deliverySalesVatPct: 15,
      platformCommissionPct: 30,
      platformCommissionVatPct: 23,
      commissionOnGross: true,
      marketingVatPct: 23,
      cardFeePct: 1,
      expenseDefaultVatPct: 23,
      marketingNetCents: { uber_eats: 0, glovo: 0, bolt_food: 0 },
      loanExpenseCents: 0,
      rentThresholdCents: 0,
      rentVariablePct: 0,
      source: "default",
    },
    revenue: {
      restaurantNetCents: 0,
      restaurantByPayment: { cardNetCents: 0, cashNetCents: 0, otherNetCents: 0 },
      platformsGrossCents: 100_000,
      platformsNetCents: 86_957,
      platformsReceivedCents: 63_100,
      byPlatform: [
        {
          platform: "uber_eats",
          source: "bank",
          receivedCents: 63_100,
          marketingNetCents: 0,
          grossCents: 100_000,
          netCents: 86_957,
          promotionsNetCents: 0,
          otherFeesNetCents: 0,
          salesVatCents: 13_043,
          commissionNetCents: 30_000,
          commissionVatCents: 6_900,
          marketingVatCents: 0,
          contributionCents: 56_957,
          contributionPct: 65.5,
        },
      ],
      totalNetCents: 86_957,
    },
    platformCosts: { commissionNetCents: 30_000, marketingNetCents: 0, promotionsNetCents: 0, otherFeesNetCents: 0, totalNetCents: 30_000 },
    cardFees: { cardGrossCents: 0, ratePct: 1, netCents: 0 },
    expenses: {
      totalNetCents: 200_000,
      vatCents: 23_000,
      estimatedVatCents: 3_000,
      pendingVatCents: 20_000,
      unclassifiedCents: 10_000,
      categories: [],
      sections: [
        { key: "cmv", netCents: 70_000, vatCents: 0, items: [{ key: "c-ing", categoryId: "c-ing", code: "OPD.01", name: "Ingredientes", movementKind: null, netCents: 70_000 }] },
        {
          key: "personnel",
          netCents: 120_000,
          vatCents: 0,
          items: [
            { key: "c-sal", categoryId: "c-sal", code: "PES.01", name: "Salários", movementKind: null, netCents: 100_000 },
            { key: "c-enc", categoryId: "c-enc", code: "PES.02", name: "Encargos", movementKind: null, netCents: 20_000 },
          ],
        },
        { key: "unclassified", netCents: 10_000, vatCents: 0, items: [{ key: "kind:card_purchase", categoryId: null, code: null, name: null, movementKind: "card_purchase", netCents: 10_000 }] },
      ],
      capexNetCents: 0,
      offOperation: { totalCents: 0, items: [] },
      unpaidInvoices: { count: 0, netCents: 0 },
    },
    resultCents: null,
    marginPct: null,
    vat: { salesCents: 13_043, purchasesCents: 29_900, purchasesEstimatedCents: 3_000, balanceCents: -16_857 },
  };
}

/** Vendas do restaurante fictícias (março). */
export function sampleRestaurantSales(): DreRestaurantSales {
  return {
    period: { year: 2026, month: 3, from: "2026-03-01", to: "2026-03-31", isCurrentMonth: false },
    netCents: 500_000,
    vatCents: 65_000,
    byPayment: { cardNetCents: 350_000, cashNetCents: 120_000, otherNetCents: 30_000 },
    cardFees: { cardGrossCents: 395_500, ratePct: 1, netCents: 3_955 },
  };
}

/** Pagamentos fictícios da DRE de março (pessoal: salários com 2 pagamentos, encargos com 1). */
export function sampleDreEntries(): DreEntries {
  const base = { section: "personnel" as const, basis: "document" as const, vatBasis: "exempt" as const, description: "Transferência enviada" };
  return {
    period: { year: 2026, month: 3, from: "2026-03-01", to: "2026-03-31", isCurrentMonth: false },
    entries: [
      { ...base, itemKey: "c-sal", movementId: "m1", paidOn: "2026-04-02", competenceDate: "2026-03-31", document: "Salários · março", grossCents: 60_000, netCents: 60_000 },
      { ...base, itemKey: "c-sal", movementId: "m2", paidOn: "2026-03-15", competenceDate: "2026-03-15", document: null, grossCents: 40_000, netCents: 40_000 },
      { ...base, itemKey: "c-enc", movementId: "m3", paidOn: "2026-04-20", competenceDate: "2026-03-31", document: "Segurança Social · março", grossCents: 20_000, netCents: 20_000 },
      { ...base, section: "cmv", itemKey: "c-ing", movementId: "fatura-por-pagar:f9", paidOn: null, competenceDate: "2026-03-28", document: "Fornecedor Teste · FT 9", grossCents: 12_300, netCents: 10_000, vatBasis: "real" },
      { ...base, section: "cmv", itemKey: "c-ing", movementId: "m4", paidOn: "2026-03-10", competenceDate: "2026-03-08", document: "Fornecedor Teste · FT 1", grossCents: 86_100, netCents: 70_000, vatBasis: "real" },
    ],
  };
}
