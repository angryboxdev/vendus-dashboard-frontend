import type { DeviceTokenSummary } from "../../entities/device-token-summary.ts";
import type { PairingCode } from "../../entities/pairing-code.ts";

export interface LocationCredentialsApiPort {
  generatePairingCode(locationId: string): Promise<PairingCode>;
  listTokens(locationId: string): Promise<DeviceTokenSummary[]>;
  revokeToken(tokenId: string): Promise<void>;
  redeem(code: string): Promise<string>;
  checkToken(): Promise<boolean>;
}
