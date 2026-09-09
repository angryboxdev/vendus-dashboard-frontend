import type { GetSalesSummaryPort } from "../../domain/ports/in/get-sales-summary.port.ts";
import type { SalesSummaryApiPort } from "../../domain/ports/out/sales-summary-api.port.ts";
import type { SalesSummaryResult } from "../../domain/entities/sales-summary.ts";

export class GetSalesSummaryUseCase implements GetSalesSummaryPort {
  private readonly api: SalesSummaryApiPort;

  constructor(api: SalesSummaryApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<SalesSummaryResult> {
    return this.api.getSummary(year, month);
  }
}
