import type { DeviceTokenStoragePort } from "../../domain/ports/out/device-token-storage.port.ts";

export class InMemoryDeviceTokenStorageAdapter implements DeviceTokenStoragePort {
  private token: string | null;

  constructor(seed: string | null = null) {
    this.token = seed;
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }
}
