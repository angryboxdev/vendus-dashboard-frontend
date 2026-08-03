import type { AirMenuSummaryData } from "../../entities/air-menu-analytics.ts";

export interface GetSummaryPort {
  execute(enterpriseId: string, startDate: Date, endDate: Date): Promise<AirMenuSummaryData>;
}
