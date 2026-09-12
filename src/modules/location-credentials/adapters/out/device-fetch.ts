import { deviceTokenHeader } from "./local-storage-device-token.adapter.ts";

/**
 * fetch() wrapper for device-token-gated routes: adds the X-Device-Token
 * header. Doesn't react to 401s — a single 401 (from any of pairing-status
 * checks, redeem, or KDS polling every ~5s) can't be told apart here from a
 * transient backend hiccup, and a device token doesn't expire on its own.
 * Clearing the stored token is solely GetPairingStatusUseCase's job: it
 * confirms revocation against the dedicated tokens/me endpoint and fails
 * open on network errors. See README.
 */
export async function deviceFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { ...init?.headers, ...deviceTokenHeader() },
  });
}
