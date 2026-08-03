import type { GetSummaryPort } from "../../domain/ports/in/get-summary.port.ts";
import type { AirMenuApiPort } from "../../domain/ports/out/air-menu-api.port.ts";
import type { AirMenuSummaryData } from "../../domain/entities/air-menu-analytics.ts";

export class GetSummaryUseCase implements GetSummaryPort {
  constructor(private readonly api: AirMenuApiPort) {}

  execute(enterpriseId: string, startDate: Date, endDate: Date): Promise<AirMenuSummaryData> {
    return this.api.fetchSummary(enterpriseId, startDate, endDate);
  }
}
