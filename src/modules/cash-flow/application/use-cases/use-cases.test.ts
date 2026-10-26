import { describe, expect, it } from "vitest";
import { GetCashFlowUseCase } from "./get-cash-flow.use-case.ts";
import { GetCashFlowToHandleUseCase } from "./get-cash-flow-to-handle.use-case.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";
import { sampleReport } from "../../domain/services/fixtures.ts";

function fakeApi(calls: [number, number][] = []): CashFlowApiPort {
  return {
    getCashFlow: async (year, month) => {
      calls.push([year, month]);
      return sampleReport();
    },
    getToHandle: async () => ({ payables: { dueCents: 100, overdueCents: 40 }, invoicesToReview: 2 }),
  };
}

describe("GetCashFlowUseCase", () => {
  it("pede o relatório do mês à API", async () => {
    const calls: [number, number][] = [];
    const report = await new GetCashFlowUseCase(fakeApi(calls)).execute(2026, 3);
    expect(calls).toEqual([[2026, 3]]);
    expect(report.totals.netCents).toBe(110_000);
  });
});

describe("GetCashFlowToHandleUseCase", () => {
  it("devolve o «Para tratar» da API", async () => {
    await expect(new GetCashFlowToHandleUseCase(fakeApi()).execute()).resolves.toEqual({
      payables: { dueCents: 100, overdueCents: 40 },
      invoicesToReview: 2,
    });
  });
});
