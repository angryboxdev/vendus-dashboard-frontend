import type { CashFlowReport } from "../../domain/entities/cash-flow.ts";
import type { GetCashFlowPort } from "../../domain/ports/in/get-cash-flow.port.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class GetCashFlowUseCase implements GetCashFlowPort {
  private readonly api: CashFlowApiPort;

  constructor(api: CashFlowApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<CashFlowReport> {
    return this.api.getCashFlow(year, month);
  }
}
