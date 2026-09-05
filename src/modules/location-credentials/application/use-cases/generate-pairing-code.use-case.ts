import type { PairingCode } from "../../domain/entities/pairing-code.ts";
import type { GeneratePairingCodePort } from "../../domain/ports/in/generate-pairing-code.port.ts";
import type { LocationCredentialsApiPort } from "../../domain/ports/out/location-credentials-api.port.ts";

export class GeneratePairingCodeUseCase implements GeneratePairingCodePort {
  private readonly api: LocationCredentialsApiPort;
  constructor(api: LocationCredentialsApiPort) {
    this.api = api;
  }

  execute(locationId: string): Promise<PairingCode> {
    return this.api.generatePairingCode(locationId);
  }
}
