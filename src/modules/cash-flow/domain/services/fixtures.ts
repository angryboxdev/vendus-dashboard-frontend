import type { CashFlowReport } from "../entities/cash-flow.ts";

/** Relatório fictício (março, mês fechado) para os testes. */
export function sampleReport(): CashFlowReport {
  return {
    period: {
      year: 2026,
      month: 3,
      from: "2026-03-01",
      to: "2026-03-31",
      monthEnd: "2026-03-31",
      isCurrentMonth: false,
      previous: { from: "2026-02-01", to: "2026-02-28" },
    },
    days: [
      { date: "2026-03-01", inflowCents: 100_000, outflowCents: 0 },
      { date: "2026-03-02", inflowCents: 50_000, outflowCents: 30_000 },
      { date: "2026-03-03", inflowCents: 0, outflowCents: 10_000 },
    ],
    previousDays: [
      { date: "2026-02-01", inflowCents: 80_000, outflowCents: 20_000 },
      { date: "2026-02-02", inflowCents: 0, outflowCents: 30_000 },
    ],
    totals: { inflowCents: 150_000, outflowCents: 40_000, netCents: 110_000, marginPct: 73.3 },
    previousTotals: { inflowCents: 80_000, outflowCents: 50_000, netCents: 30_000, marginPct: 37.5 },
    inflowKinds: [
      { movementKind: "sales", amountCents: 120_000, previousAmountCents: 80_000 },
      { movementKind: "transfer_in", amountCents: 30_000, previousAmountCents: 0 },
    ],
    categories: [
      {
        key: "g-pes",
        type: "group",
        groupId: "g-pes",
        code: "PES",
        name: "Pessoal",
        movementKind: null,
        amountCents: 25_000,
        previousAmountCents: 20_000,
        children: [
          { key: "c-sal", categoryId: "c-sal", code: "PES.01", name: "Salários", amountCents: 20_000, previousAmountCents: 20_000 },
          { key: "c-enc", categoryId: "c-enc", code: "PES.02", name: "Encargos", amountCents: 5_000, previousAmountCents: 0 },
        ],
      },
      { key: "kind:transfer_out", type: "unclassified", groupId: null, code: null, name: null, movementKind: "transfer_out", amountCents: 8_000, previousAmountCents: 0, children: [] },
      { key: "g-opd", type: "group", groupId: "g-opd", code: "OPD", name: "Operação Direta", movementKind: null, amountCents: 5_000, previousAmountCents: 25_000, children: [] },
      { key: "g-est", type: "group", groupId: "g-est", code: "EST", name: "Estrutura & Instalações", movementKind: null, amountCents: 2_000, previousAmountCents: 5_000, children: [] },
    ],
    justification: { totalCents: 40_000, justifiedCents: 32_400, percent: 81, pendingCount: 2 },
  };
}
