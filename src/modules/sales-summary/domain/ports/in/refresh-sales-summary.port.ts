import type { SalesSummaryResult } from "../../entities/sales-summary.ts";

export interface RefreshSalesSummaryPort {
  execute(year: number, month: number): Promise<SalesSummaryResult>;
}
