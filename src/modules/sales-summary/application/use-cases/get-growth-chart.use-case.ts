import type { MonthlyGrowthPoint } from "../../domain/entities/sales-summary.ts";
import type { GetGrowthChartPort } from "../../domain/ports/in/get-growth-chart.port.ts";
import type { SalesSummaryApiPort } from "../../domain/ports/out/sales-summary-api.port.ts";

export class GetGrowthChartUseCase implements GetGrowthChartPort {
  constructor(private readonly api: SalesSummaryApiPort) {}

  execute(year: number): Promise<MonthlyGrowthPoint[]> {
    return this.api.getGrowthChart(year);
  }
}
