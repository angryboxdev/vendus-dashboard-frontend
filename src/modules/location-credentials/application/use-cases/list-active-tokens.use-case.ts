import type { DeviceTokenSummary } from "../../domain/entities/device-token-summary.ts";
import type { ListActiveTokensPort } from "../../domain/ports/in/list-active-tokens.port.ts";
import type { LocationCredentialsApiPort } from "../../domain/ports/out/location-credentials-api.port.ts";

export class ListActiveTokensUseCase implements ListActiveTokensPort {
  private readonly api: LocationCredentialsApiPort;
  constructor(api: LocationCredentialsApiPort) {
    this.api = api;
  }

  execute(locationId: string): Promise<DeviceTokenSummary[]> {
    return this.api.listTokens(locationId);
  }
}
