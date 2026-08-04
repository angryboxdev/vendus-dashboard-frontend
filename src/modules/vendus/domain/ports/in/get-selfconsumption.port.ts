import type { VendusSelfConsumptionResult } from "../../entities/vendus-selfconsumption.ts";

export interface GetSelfConsumptionPort {
  execute(since: string, until: string): Promise<VendusSelfConsumptionResult>;
}
