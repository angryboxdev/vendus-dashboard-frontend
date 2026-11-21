import { apiGet, apiPost } from "../../../../lib/api.ts";
import type { AirMenuMonthStatus, DateRange, ForecastResult, SalesAnalysisData, SourceSelection } from "../../domain/entities/sales-analysis.ts";
import type { SalesAnalysisApiPort } from "../../domain/ports/out/sales-analysis-api.port.ts";

export class HttpSalesAnalysisApiAdapter implements SalesAnalysisApiPort {
  getAnalysis(range: DateRange, source: SourceSelection): Promise<SalesAnalysisData> {
    const qs = new URLSearchParams({ from: range.from, to: range.to, source });
    return apiGet<SalesAnalysisData>(`/api/sales-analysis?${qs}`);
  }

  fetchAirMenuMonth(month: string): Promise<AirMenuMonthStatus> {
    return apiPost<AirMenuMonthStatus>("/api/sales-analysis/air-menu/fetch", { month });
  }

  getForecast(source: SourceSelection): Promise<ForecastResult> {
    return apiGet<ForecastResult>(`/api/sales-analysis/forecast?${new URLSearchParams({ source })}`);
  }
}
