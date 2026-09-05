import type { GetPairingStatusPort, PairingStatus } from "../../domain/ports/in/get-pairing-status.port.ts";
import type { DeviceTokenStoragePort } from "../../domain/ports/out/device-token-storage.port.ts";
import type { LocationCredentialsApiPort } from "../../domain/ports/out/location-credentials-api.port.ts";

export class GetPairingStatusUseCase implements GetPairingStatusPort {
  private readonly storage: DeviceTokenStoragePort;
  private readonly api: LocationCredentialsApiPort;

  constructor(storage: DeviceTokenStoragePort, api: LocationCredentialsApiPort) {
    this.storage = storage;
    this.api = api;
  }

  async execute(): Promise<PairingStatus> {
    if (this.storage.getToken() === null) return { paired: false };

    const valid = await this.confirmStoredToken();
    if (!valid) this.storage.clearToken();
    return { paired: valid };
  }

  private async confirmStoredToken(): Promise<boolean> {
    try {
      return await this.api.checkToken();
    } catch {
      return true;
    }
  }
}
