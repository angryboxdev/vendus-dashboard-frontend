import type { DreReport, DreRestaurantSales } from "../entities/dre.ts";

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
          receivedCents: 63_100,
          marketingNetCents: 0,
          grossCents: 100_000,
          netCents: 86_957,
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
    platformCosts: { commissionNetCents: 30_000, marketingNetCents: 0, totalNetCents: 30_000 },
    cardFees: { cardGrossCents: 0, ratePct: 1, netCents: 0 },
    expenses: {
      totalNetCents: 200_000,
      vatCents: 23_000,
      estimatedVatCents: 3_000,
      pendingVatCents: 20_000,
      unclassifiedCents: 10_000,
      categories: [],
      sections: [
        { key: "cmv", netCents: 70_000, items: [{ key: "c-ing", categoryId: "c-ing", code: "OPD.01", name: "Ingredientes", movementKind: null, netCents: 70_000 }] },
        {
          key: "personnel",
          netCents: 120_000,
          items: [
            { key: "c-sal", categoryId: "c-sal", code: "PES.01", name: "Salários", movementKind: null, netCents: 100_000 },
            { key: "c-enc", categoryId: "c-enc", code: "PES.02", name: "Encargos", movementKind: null, netCents: 20_000 },
          ],
        },
        { key: "unclassified", netCents: 10_000, items: [{ key: "kind:card_purchase", categoryId: null, code: null, name: null, movementKind: "card_purchase", netCents: 10_000 }] },
      ],
      capexNetCents: 0,
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
