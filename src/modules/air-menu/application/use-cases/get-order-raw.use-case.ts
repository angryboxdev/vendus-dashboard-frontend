import type { GetOrderRawPort } from "../../domain/ports/in/get-order-raw.port.ts";
import type { AirMenuApiPort } from "../../domain/ports/out/air-menu-api.port.ts";

export class GetOrderRawUseCase implements GetOrderRawPort {
  private readonly api: AirMenuApiPort;

  constructor(api: AirMenuApiPort) {
    this.api = api;
  }

  execute(enterpriseId: string, orderId: string): Promise<Record<string, unknown>[]> {
    return this.api.fetchOrderRaw(enterpriseId, orderId);
  }
}
