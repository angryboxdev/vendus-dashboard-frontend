import { apiGet } from "../../../../lib/api.ts";
import type { VendusApiPort } from "../../domain/ports/out/vendus-api.port.ts";
import type { VendusSummaryResult } from "../../domain/entities/vendus-analytics.ts";
import type { VendusSelfConsumptionResult } from "../../domain/entities/vendus-selfconsumption.ts";

export class HttpVendusApiAdapter implements VendusApiPort {
  fetchSummary(since: string, until: string): Promise<VendusSummaryResult> {
    const qs = new URLSearchParams({ since, until });
    return apiGet<VendusSummaryResult>(`/api/vendus/summary?${qs}`);
  }

  fetchSelfConsumption(since: string, until: string): Promise<VendusSelfConsumptionResult> {
    const qs = new URLSearchParams({ since, until });
    return apiGet<VendusSelfConsumptionResult>(`/api/vendus/selfconsumption?${qs}`);
  }
}
