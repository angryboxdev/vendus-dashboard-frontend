import { PairingCode } from "../../domain/entities/pairing-code.ts";
import type { DeviceTokenSummary } from "../../domain/entities/device-token-summary.ts";
import {
  InvalidPairingCodeError,
  PairingCodeAlreadyUsedError,
  PairingCodeExpiredError,
  PairingCodeNotFoundError,
} from "../../domain/entities/pairing-errors.ts";
import type { LocationCredentialsApiPort } from "../../domain/ports/out/location-credentials-api.port.ts";

export type SeededPairingCodeStatus = "valid" | "used" | "expired";

export interface SeededPairingCode {
  code: string;
  locationId: string;
  status: SeededPairingCodeStatus;
  expiresAt?: Date;
}

const CODE_PATTERN = /^[A-Z0-9]{8}$/;

export type SeededTokenCheck = "valid" | "invalid" | "error";

/** Test fake for LocationCredentialsApiPort. Use InMemoryLocationCredentialsApiAdapter.withSeed to drive redeem's branches. */
export class InMemoryLocationCredentialsApiAdapter implements LocationCredentialsApiPort {
  private codes: SeededPairingCode[];
  private tokensByLocation: Map<string, DeviceTokenSummary[]>;
  private tokenCheck: SeededTokenCheck;

  constructor(
    codes: SeededPairingCode[] = [],
    tokens: Record<string, DeviceTokenSummary[]> = {},
    tokenCheck: SeededTokenCheck = "valid",
  ) {
    this.codes = [...codes];
    this.tokensByLocation = new Map(Object.entries(tokens).map(([id, list]) => [id, [...list]]));
    this.tokenCheck = tokenCheck;
  }

  static withSeed(
    params: {
      codes?: SeededPairingCode[];
      tokens?: Record<string, DeviceTokenSummary[]>;
      tokenCheck?: SeededTokenCheck;
    } = {},
  ): InMemoryLocationCredentialsApiAdapter {
    return new InMemoryLocationCredentialsApiAdapter(params.codes ?? [], params.tokens ?? {}, params.tokenCheck ?? "valid");
  }

  generatePairingCode(locationId: string): Promise<PairingCode> {
    const pairingCode = PairingCode.create({
      code: "GENRT" + String(this.codes.length).padStart(3, "0"),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });
    this.codes.push({ code: pairingCode.code, locationId, status: "valid", expiresAt: pairingCode.expiresAt });
    return Promise.resolve(pairingCode);
  }

  listTokens(locationId: string): Promise<DeviceTokenSummary[]> {
    return Promise.resolve(this.tokensByLocation.get(locationId) ?? []);
  }

  revokeToken(tokenId: string): Promise<void> {
    for (const [locationId, tokens] of this.tokensByLocation) {
      this.tokensByLocation.set(locationId, tokens.filter((t) => t.id !== tokenId));
    }
    return Promise.resolve();
  }

  redeem(code: string): Promise<string> {
    if (!CODE_PATTERN.test(code)) throw new InvalidPairingCodeError();
    const entry = this.codes.find((c) => c.code === code);
    if (!entry) throw new PairingCodeNotFoundError();
    if (entry.status === "used") throw new PairingCodeAlreadyUsedError();
    if (entry.status === "expired") throw new PairingCodeExpiredError();
    entry.status = "used";
    return Promise.resolve(`device-token-${code}`);
  }

  checkToken(): Promise<boolean> {
    if (this.tokenCheck === "error") return Promise.reject(new Error("network error"));
    return Promise.resolve(this.tokenCheck === "valid");
  }
}
