import type { AirMenuMonthStatus, DateRange, ForecastResult, SalesAnalysisData, SourceSelection } from "../../entities/sales-analysis.ts";

export interface GetSalesAnalysisPort {
  execute(range: DateRange, source: SourceSelection): Promise<SalesAnalysisData>;
}

/** Busca um mês à AirMenu (só os dias ainda não guardados). */
export interface FetchAirMenuMonthPort {
  execute(month: string): Promise<AirMenuMonthStatus>;
}

export interface GetSalesForecastPort {
  execute(source: SourceSelection): Promise<ForecastResult>;
}
