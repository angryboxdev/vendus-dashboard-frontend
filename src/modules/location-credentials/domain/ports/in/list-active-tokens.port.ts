import type { DeviceTokenSummary } from "../../entities/device-token-summary.ts";

export interface ListActiveTokensPort {
  execute(locationId: string): Promise<DeviceTokenSummary[]>;
}
