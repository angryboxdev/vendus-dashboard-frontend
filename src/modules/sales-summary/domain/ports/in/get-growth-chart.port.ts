import type { MonthlyGrowthPoint } from "../../entities/sales-summary.ts";

export interface GetGrowthChartPort {
  execute(year: number): Promise<MonthlyGrowthPoint[]>;
}
