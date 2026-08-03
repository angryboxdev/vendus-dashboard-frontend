import type { AirMenuEnterprise } from "../../entities/air-menu-enterprise.ts";
import type { AirMenuSummaryData } from "../../entities/air-menu-analytics.ts";

export interface AirMenuApiPort {
  fetchEnterprises(): Promise<AirMenuEnterprise[]>;
  fetchSummary(enterpriseId: string, startDate: Date, endDate: Date): Promise<AirMenuSummaryData>;
  fetchOrderRaw(enterpriseId: string, orderId: string): Promise<Record<string, unknown>[]>;
}
