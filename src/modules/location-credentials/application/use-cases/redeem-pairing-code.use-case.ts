import type { RedeemPairingCodePort } from "../../domain/ports/in/redeem-pairing-code.port.ts";
import type { LocationCredentialsApiPort } from "../../domain/ports/out/location-credentials-api.port.ts";
import type { DeviceTokenStoragePort } from "../../domain/ports/out/device-token-storage.port.ts";

export class RedeemPairingCodeUseCase implements RedeemPairingCodePort {
  private readonly api: LocationCredentialsApiPort;
  private readonly storage: DeviceTokenStoragePort;
  constructor(api: LocationCredentialsApiPort, storage: DeviceTokenStoragePort) {
    this.api = api;
    this.storage = storage;
  }

  async execute(code: string): Promise<void> {
    const token = await this.api.redeem(code);
    this.storage.setToken(token);
  }
}
