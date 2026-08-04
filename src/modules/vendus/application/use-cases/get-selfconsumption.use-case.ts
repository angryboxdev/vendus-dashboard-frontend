import type { GetSelfConsumptionPort } from "../../domain/ports/in/get-selfconsumption.port.ts";
import type { VendusApiPort } from "../../domain/ports/out/vendus-api.port.ts";
import type { VendusSelfConsumptionResult } from "../../domain/entities/vendus-selfconsumption.ts";

export class GetSelfConsumptionUseCase implements GetSelfConsumptionPort {
  constructor(private readonly api: VendusApiPort) {}

  execute(since: string, until: string): Promise<VendusSelfConsumptionResult> {
    return this.api.fetchSelfConsumption(since, until);
  }
}
