import type { AirMenuMonthStatus, DateRange, ForecastResult, SalesAnalysisData, SourceSelection } from "../../entities/sales-analysis.ts";

export interface SalesAnalysisApiPort {
  getAnalysis(range: DateRange, source: SourceSelection): Promise<SalesAnalysisData>;
  fetchAirMenuMonth(month: string): Promise<AirMenuMonthStatus>;
  getForecast(source: SourceSelection): Promise<ForecastResult>;
}
