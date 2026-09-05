import type { PairingCode } from "../../entities/pairing-code.ts";

export interface GeneratePairingCodePort {
  execute(locationId: string): Promise<PairingCode>;
}
