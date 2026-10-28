import type { DreReport } from "../../domain/entities/dre.ts";
import type { GetDrePort } from "../../domain/ports/in/get-dre.port.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class GetDreUseCase implements GetDrePort {
  private readonly api: CashFlowApiPort;

  constructor(api: CashFlowApiPort) {
    this.api = api;
  }

  execute(year: number, month: number, withRestaurantSales = true): Promise<DreReport> {
    return this.api.getDre(year, month, withRestaurantSales);
  }
}
