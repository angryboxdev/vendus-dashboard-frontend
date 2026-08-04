import type { VendusSummaryResult } from "../../entities/vendus-analytics.ts";
import type { VendusSelfConsumptionResult } from "../../entities/vendus-selfconsumption.ts";

export interface VendusApiPort {
  fetchSummary(since: string, until: string): Promise<VendusSummaryResult>;
  fetchSelfConsumption(since: string, until: string): Promise<VendusSelfConsumptionResult>;
}
