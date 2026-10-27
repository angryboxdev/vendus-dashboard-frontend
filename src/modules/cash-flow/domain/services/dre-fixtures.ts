import type { DreReport } from "../entities/dre.ts";

/** DRE fictícia (março, mês fechado) para os testes. */
export function sampleDre(): DreReport {
  return {
    period: { year: 2026, month: 3, from: "2026-03-01", to: "2026-03-31", isCurrentMonth: false },
    revenue: {
      restaurantNetCents: 500_000,
      platformsNetCents: 70_000,
      platformsReceivedCents: 79_100,
      platformsSoldNetCents: 100_000,
      platformsCommissionEstimateCents: 30_000,
      platformsVatKnown: true,
      byPlatform: [{ platform: "uber_eats", receivedCents: 79_100, netCents: 70_000 }],
      totalNetCents: 570_000,
    },
    expenses: {
      totalNetCents: 200_000,
      vatCents: 23_000,
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
          pendingVatCents: 0,
          children: [
            { key: "c-sal", categoryId: "c-sal", code: "PES.01", name: "Salários", netCents: 100_000, vatCents: 0 },
            { key: "c-enc", categoryId: "c-enc", code: "PES.02", name: "Encargos", netCents: 20_000, vatCents: 0 },
          ],
        },
        { key: "g-opd", type: "group", groupId: "g-opd", code: "OPD", name: "Operação Direta", movementKind: null, netCents: 70_000, vatCents: 23_000, pendingVatCents: 10_000, children: [] },
        { key: "kind:card_purchase", type: "unclassified", groupId: null, code: null, name: null, movementKind: "card_purchase", netCents: 10_000, vatCents: 0, pendingVatCents: 10_000, children: [] },
      ],
    },
    manualAdjustments: { fixedCents: 15_000, variableCents: 0, totalCents: 15_000 },
    resultCents: 355_000,
    marginPct: 62.3,
    vat: { salesCents: 78_000, purchasesCents: 23_000, balanceCents: 55_000 },
  };
}
