import type { SalesSummaryResult } from "../../entities/sales-summary.ts";

export interface GetSalesSummaryPort {
  execute(year: number, month: number): Promise<SalesSummaryResult>;
}
