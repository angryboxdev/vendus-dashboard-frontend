import type { SalesReconciliation } from "../../domain/entities/sales-reconciliation.ts";
import type { GetSalesReconciliationPort } from "../../domain/ports/in/sales-reconciliation.port.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class GetSalesReconciliationUseCase implements GetSalesReconciliationPort {
  private readonly api: CashFlowApiPort;

  constructor(api: CashFlowApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<SalesReconciliation> {
    return this.api.getSalesReconciliation(year, month);
  }
}
