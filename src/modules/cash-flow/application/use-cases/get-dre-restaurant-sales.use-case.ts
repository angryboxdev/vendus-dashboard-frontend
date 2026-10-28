import type { DreRestaurantSales } from "../../domain/entities/dre.ts";
import type { GetDreRestaurantSalesPort } from "../../domain/ports/in/get-dre-restaurant-sales.port.ts";
import type { CashFlowApiPort } from "../../domain/ports/out/cash-flow-api.port.ts";

export class GetDreRestaurantSalesUseCase implements GetDreRestaurantSalesPort {
  private readonly api: CashFlowApiPort;

  constructor(api: CashFlowApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<DreRestaurantSales> {
    return this.api.getDreRestaurantSales(year, month);
  }
}
