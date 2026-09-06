import { apiGet, apiPost } from "../../../../lib/api.ts";
import type { SalesSummaryApiPort } from "../../domain/ports/out/sales-summary-api.port.ts";
import type { MonthlyGrowthPoint, SalesSummaryResult } from "../../domain/entities/sales-summary.ts";

export class HttpSalesSummaryApiAdapter implements SalesSummaryApiPort {
  getSummary(year: number, month: number): Promise<SalesSummaryResult> {
    return apiGet<SalesSummaryResult>(
      `/api/sales-summary?year=${year}&month=${month}`,
    );
  }

  refreshSummary(year: number, month: number): Promise<SalesSummaryResult> {
    return apiPost<SalesSummaryResult>(
      `/api/sales-summary/refresh?year=${year}&month=${month}`,
      null,
    );
  }

  getGrowthChart(year: number): Promise<MonthlyGrowthPoint[]> {
    return apiGet<MonthlyGrowthPoint[]>(`/api/sales-summary/growth?year=${year}`);
  }
}
