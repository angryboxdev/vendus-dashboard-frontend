import type { MonthlyGrowthPoint, SalesSummaryResult } from "../../entities/sales-summary.ts";

export interface SalesSummaryApiPort {
  getSummary(year: number, month: number): Promise<SalesSummaryResult>;
  refreshSummary(year: number, month: number): Promise<SalesSummaryResult>;
  getGrowthChart(year: number): Promise<MonthlyGrowthPoint[]>;
}
