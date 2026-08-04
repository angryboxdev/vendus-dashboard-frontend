import type { GetSummaryPort } from "../../domain/ports/in/get-summary.port.ts";
import type { VendusApiPort } from "../../domain/ports/out/vendus-api.port.ts";
import type { VendusSummaryResult } from "../../domain/entities/vendus-analytics.ts";

export class GetSummaryUseCase implements GetSummaryPort {
  constructor(private readonly api: VendusApiPort) {}

  execute(since: string, until: string): Promise<VendusSummaryResult> {
    return this.api.fetchSummary(since, until);
  }
}
