import { clearStoredDeviceToken, deviceTokenHeader } from "./local-storage-device-token.adapter.ts";

export const DEVICE_AUTH_ERROR_MESSAGE = "Invalid or missing device credentials";

/**
 * fetch() wrapper for device-token-gated routes. Clears the stored token and
 * reloads only when a 401's body matches the exact backend device-auth
 * rejection message — verify-pin and kiosk/scan also 401 on a wrong PIN
 * (InvalidPinError), which must NOT clear pairing. This string-match is a
 * known fragility: no dedicated error code exists on the wire to
 * disambiguate more robustly. See README.
 */
export async function deviceFetch(url: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { ...init?.headers, ...deviceTokenHeader() },
  });
  if (res.status === 401) {
    const body = (await res.clone().json().catch(() => ({}))) as { error?: string };
    if (body.error === DEVICE_AUTH_ERROR_MESSAGE) {
      clearStoredDeviceToken();
      window.location.reload();
    }
  }
  return res;
}
