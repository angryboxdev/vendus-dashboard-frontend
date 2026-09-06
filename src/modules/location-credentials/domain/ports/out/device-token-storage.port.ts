export interface DeviceTokenStoragePort {
  getToken(): string | null;
  setToken(token: string): void;
  clearToken(): void;
}
