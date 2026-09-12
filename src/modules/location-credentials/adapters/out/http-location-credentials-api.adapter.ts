import { apiDeleteNoContent, apiGet, apiPost, API_BASE } from "../../../../lib/api.ts";
import { PairingCode } from "../../domain/entities/pairing-code.ts";
import type { DeviceTokenSummary } from "../../domain/entities/device-token-summary.ts";
import {
  InvalidPairingCodeError,
  PairingCodeAlreadyUsedError,
  PairingCodeExpiredError,
  PairingCodeNotFoundError,
} from "../../domain/entities/pairing-errors.ts";
import type { LocationCredentialsApiPort } from "../../domain/ports/out/location-credentials-api.port.ts";
import { deviceFetch } from "./device-fetch.ts";

const BASE = "/api/location-credentials";

interface PairingCodeDto {
  code: string;
  expiresAt: string;
  description: string | null;
}

interface DeviceTokenSummaryDto {
  id: string;
  issuedAt: string;
  locationName: string;
  description: string | null;
}

function toPairingCode(dto: PairingCodeDto): PairingCode {
  return PairingCode.create({ code: dto.code, expiresAt: new Date(dto.expiresAt), description: dto.description });
}

function toDeviceTokenSummary(dto: DeviceTokenSummaryDto): DeviceTokenSummary {
  return {
    id: dto.id,
    issuedAt: new Date(dto.issuedAt),
    locationName: dto.locationName,
    description: dto.description,
  };
}

function throwForRedeemStatus(status: number): never {
  if (status === 404) throw new PairingCodeNotFoundError();
  if (status === 409) throw new PairingCodeAlreadyUsedError();
  if (status === 410) throw new PairingCodeExpiredError();
  throw new InvalidPairingCodeError();
}

/**
 * Mixes authenticated admin ops (apiGet/apiPost/apiDeleteNoContent, auto
 * bearer) with the public device redeem call (deviceFetch, no bearer) in one
 * adapter — same precedent as HttpCashClosingApiAdapter.
 */
export class HttpLocationCredentialsApiAdapter implements LocationCredentialsApiPort {
  async generatePairingCode(locationId: string, description?: string): Promise<PairingCode> {
    const body = description ? { locationId, description } : { locationId };
    const dto = await apiPost<PairingCodeDto>(`${BASE}/pairing-codes`, body);
    return toPairingCode(dto);
  }

  async listTokens(locationId: string): Promise<DeviceTokenSummary[]> {
    const dtos = await apiGet<DeviceTokenSummaryDto[]>(
      `${BASE}/locations/${encodeURIComponent(locationId)}/tokens`,
    );
    return dtos.map(toDeviceTokenSummary);
  }

  async revokeToken(tokenId: string): Promise<void> {
    await apiDeleteNoContent(`${BASE}/tokens/${encodeURIComponent(tokenId)}`);
  }

  async redeem(code: string): Promise<string> {
    const res = await deviceFetch(`${API_BASE}${BASE}/redeem`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) throwForRedeemStatus(res.status);
    const data = (await res.json()) as { token: string };
    return data.token;
  }

  async checkToken(): Promise<boolean> {
    const res = await deviceFetch(`${API_BASE}${BASE}/tokens/me`);
    if (res.ok) return true;
    // Only a 401 is the backend's device-auth middleware confirming the
    // token is missing/unknown/revoked — see requireDeviceAuth. Anything
    // else resolved (500 from a genuine lookup error, 502/503 from a proxy
    // during a deploy restart, ...) is not that confirmation, so it's
    // thrown here instead of resolved `false`: GetPairingStatusUseCase's
    // existing catch already fails open on a thrown checkToken() the same
    // way it does for a network exception, and must not clear a token on a
    // transient backend hiccup.
    if (res.status === 401) return false;
    throw new Error(`checkToken received unexpected status ${res.status}`);
  }
}
