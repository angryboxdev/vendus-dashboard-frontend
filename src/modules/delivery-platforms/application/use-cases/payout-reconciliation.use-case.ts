import type { PayoutReconciliation } from "../../domain/entities/payout-reconciliation.ts";
import type { GetPayoutReconciliationPort } from "../../domain/ports/in/payout-reconciliation.port.ts";
import type { DeliveryPlatformsApiPort } from "../../domain/ports/out/delivery-platforms-api.port.ts";

export class GetPayoutReconciliationUseCase implements GetPayoutReconciliationPort {
  private readonly api: DeliveryPlatformsApiPort;

  constructor(api: DeliveryPlatformsApiPort) {
    this.api = api;
  }

  execute(year: number, month: number): Promise<PayoutReconciliation> {
    return this.api.getPayoutReconciliation(year, month);
  }
}
