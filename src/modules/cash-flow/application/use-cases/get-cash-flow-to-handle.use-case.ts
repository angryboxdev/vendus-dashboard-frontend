import type { CashFlowToHandle } from "../../domain/entities/cash-flow.ts";
import type { GetCashFlowToHandlePort } from "../../domain/ports/in/get-cash-flow-to-handle.port.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class GetCashFlowToHandleUseCase implements GetCashFlowToHandlePort {
  private readonly api: CashFlowApiPort;

  constructor(api: CashFlowApiPort) {
    this.api = api;
  }

  execute(): Promise<CashFlowToHandle | null> {
    return this.api.getToHandle();
  }
}
