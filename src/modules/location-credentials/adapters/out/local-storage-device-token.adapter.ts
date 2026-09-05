import type { DeviceTokenStoragePort } from "../../domain/ports/out/device-token-storage.port.ts";

const STORAGE_KEY = "angrybox.deviceToken";

export class LocalStorageDeviceTokenAdapter implements DeviceTokenStoragePort {
  getToken(): string | null {
    return window.localStorage.getItem(STORAGE_KEY);
  }

  setToken(token: string): void {
    window.localStorage.setItem(STORAGE_KEY, token);
  }

  clearToken(): void {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

/**
 * Plain exported functions for the legacy consumer seam (cashClosingApi.ts,
 * kdsApi.ts, hrApi.ts's kioskScan, KdsPage.tsx) — deliberate, temporary
 * exception: those files predate this module's DI and call fetch directly,
 * outside any composition root. See README "Pontos de atenção".
 */
export function getStoredDeviceToken(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function clearStoredDeviceToken(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function deviceTokenHeader(): Record<string, string> {
  const token = getStoredDeviceToken();
  return token ? { "X-Device-Token": token } : {};
}
