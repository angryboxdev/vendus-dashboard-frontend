import type { GetOrderRawPort } from "../../domain/ports/in/get-order-raw.port.ts";
import type { AirMenuApiPort } from "../../domain/ports/out/air-menu-api.port.ts";

export class GetOrderRawUseCase implements GetOrderRawPort {
  constructor(private readonly api: AirMenuApiPort) {}

  execute(enterpriseId: string, orderId: string): Promise<Record<string, unknown>[]> {
    return this.api.fetchOrderRaw(enterpriseId, orderId);
  }
}
