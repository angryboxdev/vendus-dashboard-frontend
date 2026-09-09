import type { RefreshSalesSummaryPort } from "../../domain/ports/in/refresh-sales-summary.port.ts";
import type { SalesSummaryApiPort } from "../../domain/ports/out/sales-summary-api.port.ts";
import type { SalesSummaryResult } from "../../domain/entities/sales-summary.ts";

export class RefreshSalesSummaryUseCase implements RefreshSalesSummaryPort {
  private readonly api: SalesSummaryApiPort;

  constructor(api: SalesSummaryApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<SalesSummaryResult> {
    return this.api.refreshSummary(year, month);
  }
}
