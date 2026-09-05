import type { GetPairingStatusPort, PairingStatus } from "../../domain/ports/in/get-pairing-status.port.ts";
import type { DeviceTokenStoragePort } from "../../domain/ports/out/device-token-storage.port.ts";

export class GetPairingStatusUseCase implements GetPairingStatusPort {
  private readonly storage: DeviceTokenStoragePort;
  constructor(storage: DeviceTokenStoragePort) {
    this.storage = storage;
  }

  execute(): PairingStatus {
    return { paired: this.storage.getToken() !== null };
  }
}
