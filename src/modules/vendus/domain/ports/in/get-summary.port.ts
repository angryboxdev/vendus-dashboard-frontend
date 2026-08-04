import type { VendusSummaryResult } from "../../entities/vendus-analytics.ts";

export interface GetSummaryPort {
  execute(since: string, until: string): Promise<VendusSummaryResult>;
}
