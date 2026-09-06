import type { RevokeTokenPort } from "../../domain/ports/in/revoke-token.port.ts";
import type { LocationCredentialsApiPort } from "../../domain/ports/out/location-credentials-api.port.ts";

export class RevokeTokenUseCase implements RevokeTokenPort {
  private readonly api: LocationCredentialsApiPort;
  constructor(api: LocationCredentialsApiPort) {
    this.api = api;
  }

  execute(tokenId: string): Promise<void> {
    return this.api.revokeToken(tokenId);
  }
}
