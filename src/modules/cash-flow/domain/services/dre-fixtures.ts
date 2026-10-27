import type { DreReport } from "../entities/dre.ts";

/** DRE fictícia (março, mês fechado) para os testes. */
export function sampleDre(): DreReport {
  return {
    period: { year: 2026, month: 3, from: "2026-03-01", to: "2026-03-31", isCurrentMonth: false },
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
      restaurantNetCents: 500_000,
      restaurantByPayment: { cardNetCents: 350_000, cashNetCents: 120_000, otherNetCents: 30_000 },
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
      totalNetCents: 586_957,
    },
    platformCosts: { commissionNetCents: 30_000, marketingNetCents: 0, totalNetCents: 30_000 },
    expenses: {
      totalNetCents: 200_000,
      vatCents: 23_000,
      estimatedVatCents: 3_000,
      pendingVatCents: 20_000,
      unclassifiedCents: 10_000,
      categories: [
        {
          key: "g-pes",
          type: "group",
          groupId: "g-pes",
          code: "PES",
          name: "Pessoal",
          movementKind: null,
          netCents: 120_000,
          vatCents: 0,
          estimatedVatCents: 0,
          pendingVatCents: 0,
          children: [
            { key: "c-sal", categoryId: "c-sal", code: "PES.01", name: "Salários", netCents: 100_000, vatCents: 0 },
            { key: "c-enc", categoryId: "c-enc", code: "PES.02", name: "Encargos", netCents: 20_000, vatCents: 0 },
          ],
        },
        { key: "g-opd", type: "group", groupId: "g-opd", code: "OPD", name: "Operação Direta", movementKind: null, netCents: 70_000, vatCents: 23_000, estimatedVatCents: 3_000, pendingVatCents: 10_000, children: [] },
        { key: "kind:card_purchase", type: "unclassified", groupId: null, code: null, name: null, movementKind: "card_purchase", netCents: 10_000, vatCents: 0, estimatedVatCents: 0, pendingVatCents: 10_000, children: [] },
      ],
    },
    manualAdjustments: { fixedCents: 15_000, variableCents: 0, totalCents: 15_000 },
    resultCents: 341_957,
    marginPct: 58.3,
    vat: { salesCents: 78_043, purchasesCents: 29_900, purchasesEstimatedCents: 3_000, balanceCents: 48_143 },
  };
}
