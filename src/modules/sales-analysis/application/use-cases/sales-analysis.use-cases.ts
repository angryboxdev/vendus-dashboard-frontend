import type { AirMenuMonthStatus, DateRange, ForecastResult, SalesAnalysisData, SourceSelection } from "../../domain/entities/sales-analysis.ts";
import type { FetchAirMenuMonthPort, GetSalesAnalysisPort, GetSalesForecastPort } from "../../domain/ports/in/sales-analysis.ports.ts";
import type { SalesAnalysisApiPort } from "../../domain/ports/out/sales-analysis-api.port.ts";
import { rangeProblem } from "../../domain/services/periods.ts";

export class GetSalesAnalysisUseCase implements GetSalesAnalysisPort {
  private readonly api: SalesAnalysisApiPort;
  private readonly today: () => string;
  constructor(api: SalesAnalysisApiPort, today: () => string) {
    this.api = api;
    this.today = today;
  }

  async execute(range: DateRange, source: SourceSelection): Promise<SalesAnalysisData> {
    const problem = rangeProblem(range, this.today());
    if (problem) throw new Error(problem);
    return this.api.getAnalysis(range, source);
  }
}

export class FetchAirMenuMonthUseCase implements FetchAirMenuMonthPort {
  private readonly api: SalesAnalysisApiPort;
  constructor(api: SalesAnalysisApiPort) {
    this.api = api;
  }

  async execute(month: string): Promise<AirMenuMonthStatus> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Mês inválido.");
    return this.api.fetchAirMenuMonth(month);
  }
}

export class GetSalesForecastUseCase implements GetSalesForecastPort {
  private readonly api: SalesAnalysisApiPort;
  constructor(api: SalesAnalysisApiPort) {
    this.api = api;
  }

  execute(source: SourceSelection): Promise<ForecastResult> {
    return this.api.getForecast(source);
  }
}
