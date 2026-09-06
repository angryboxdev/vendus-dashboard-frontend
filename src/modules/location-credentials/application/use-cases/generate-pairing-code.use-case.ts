import type { PairingCode } from "../../domain/entities/pairing-code.ts";
import type { GeneratePairingCodePort } from "../../domain/ports/in/generate-pairing-code.port.ts";
import type { LocationCredentialsApiPort } from "../../domain/ports/out/location-credentials-api.port.ts";

export class GeneratePairingCodeUseCase implements GeneratePairingCodePort {
  private readonly api: LocationCredentialsApiPort;
  constructor(api: LocationCredentialsApiPort) {
    this.api = api;
  }

  execute(locationId: string, description?: string): Promise<PairingCode> {
    const trimmed = description?.trim();
    return this.api.generatePairingCode(locationId, trimmed ? trimmed : undefined);
  }
}
