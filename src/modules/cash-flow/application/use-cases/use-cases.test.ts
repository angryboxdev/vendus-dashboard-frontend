import { describe, expect, it } from "vitest";
import { GetCashFlowUseCase } from "./get-cash-flow.use-case.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";
import { sampleReport } from "../../domain/services/fixtures.ts";

describe("GetCashFlowUseCase", () => {
  it("pede o relatório do mês à API", async () => {
    const calls: [number, number][] = [];
    const api: CashFlowApiPort = {
      getCashFlow: async (year, month) => {
        calls.push([year, month]);
        return sampleReport();
      },
    };
    const report = await new GetCashFlowUseCase(api).execute(2026, 3);
    expect(calls).toEqual([[2026, 3]]);
    expect(report.totals.netCents).toBe(110_000);
  });
});
