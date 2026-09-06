import { describe, expect, it, vi } from "vitest";
import { InMemoryLocationCredentialsApiAdapter } from "../../adapters/out/in-memory-location-credentials-api.adapter.ts";
import { InMemoryDeviceTokenStorageAdapter } from "../../adapters/out/in-memory-device-token-storage.adapter.ts";
import { GeneratePairingCodeUseCase } from "./generate-pairing-code.use-case.ts";
import { ListActiveTokensUseCase } from "./list-active-tokens.use-case.ts";
import { RevokeTokenUseCase } from "./revoke-token.use-case.ts";
import { RedeemPairingCodeUseCase } from "./redeem-pairing-code.use-case.ts";
import { GetPairingStatusUseCase } from "./get-pairing-status.use-case.ts";
import {
  InvalidPairingCodeError,
  PairingCodeAlreadyUsedError,
  PairingCodeExpiredError,
  PairingCodeNotFoundError,
} from "../../domain/entities/pairing-errors.ts";

describe("GeneratePairingCodeUseCase", () => {
  it("returns a fresh pairing code for the location", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed();
    const useCase = new GeneratePairingCodeUseCase(api);
    const code = await useCase.execute("loc-1");
    expect(code.code).toBeTruthy();
    expect(code.isExpired()).toBe(false);
    expect(code.description).toBeNull();
  });

  it("passes a trimmed description through to the api", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed();
    const useCase = new GeneratePairingCodeUseCase(api);
    const code = await useCase.execute("loc-1", "  Monitor da cozinha  ");
    expect(code.description).toBe("Monitor da cozinha");
  });

  it("treats a blank description as omitted", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed();
    const useCase = new GeneratePairingCodeUseCase(api);
    const code = await useCase.execute("loc-1", "   ");
    expect(code.description).toBeNull();
  });
});

describe("ListActiveTokensUseCase", () => {
  it("returns tokens scoped to the given location", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({
      tokens: {
        "loc-1": [{ id: "t1", issuedAt: new Date(), locationName: "Loja Centro" }],
        "loc-2": [{ id: "t2", issuedAt: new Date(), locationName: "Loja Norte" }],
      },
    });
    const useCase = new ListActiveTokensUseCase(api);
    const tokens = await useCase.execute("loc-1");
    expect(tokens).toEqual([
      { id: "t1", issuedAt: expect.any(Date), locationName: "Loja Centro", description: null },
    ]);
  });

  it("returns an empty list for a location with no tokens", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed();
    const useCase = new ListActiveTokensUseCase(api);
    expect(await useCase.execute("unknown")).toEqual([]);
  });
});

describe("RevokeTokenUseCase", () => {
  it("removes the token from its location's list", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({
      tokens: { "loc-1": [{ id: "t1", issuedAt: new Date(), locationName: "Loja Centro" }] },
    });
    const revoke = new RevokeTokenUseCase(api);
    await revoke.execute("t1");
    const list = new ListActiveTokensUseCase(api);
    expect(await list.execute("loc-1")).toEqual([]);
  });

  it("does not affect another location's list", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({
      tokens: {
        "loc-1": [{ id: "t1", issuedAt: new Date(), locationName: "Loja Centro" }],
        "loc-2": [{ id: "t2", issuedAt: new Date(), locationName: "Loja Norte" }],
      },
    });
    const revoke = new RevokeTokenUseCase(api);
    await revoke.execute("t1");
    const list = new ListActiveTokensUseCase(api);
    expect(await list.execute("loc-2")).toEqual([
      { id: "t2", issuedAt: expect.any(Date), locationName: "Loja Norte", description: null },
    ]);
  });
});

describe("RedeemPairingCodeUseCase", () => {
  it("persists the token via storage on success", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({
      codes: [{ code: "VALID123", locationId: "loc-1", status: "valid" }],
    });
    const storage = new InMemoryDeviceTokenStorageAdapter();
    const useCase = new RedeemPairingCodeUseCase(api, storage);
    await useCase.execute("VALID123");
    expect(storage.getToken()).toBe("device-token-VALID123");
  });

  it("throws InvalidPairingCodeError for a malformed code, without persisting a token", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed();
    const storage = new InMemoryDeviceTokenStorageAdapter();
    const useCase = new RedeemPairingCodeUseCase(api, storage);
    await expect(useCase.execute("bad")).rejects.toThrow(InvalidPairingCodeError);
    expect(storage.getToken()).toBeNull();
  });

  it("throws PairingCodeNotFoundError for an unknown code, without persisting a token", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed();
    const storage = new InMemoryDeviceTokenStorageAdapter();
    const useCase = new RedeemPairingCodeUseCase(api, storage);
    await expect(useCase.execute("MISSING1")).rejects.toThrow(PairingCodeNotFoundError);
    expect(storage.getToken()).toBeNull();
  });

  it("throws PairingCodeAlreadyUsedError for a used code, without persisting a token", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({
      codes: [{ code: "USEDCODE", locationId: "loc-1", status: "used" }],
    });
    const storage = new InMemoryDeviceTokenStorageAdapter();
    const useCase = new RedeemPairingCodeUseCase(api, storage);
    await expect(useCase.execute("USEDCODE")).rejects.toThrow(PairingCodeAlreadyUsedError);
    expect(storage.getToken()).toBeNull();
  });

  it("throws PairingCodeExpiredError for an expired code, without persisting a token", async () => {
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({
      codes: [{ code: "EXPIRED1", locationId: "loc-1", status: "expired" }],
    });
    const storage = new InMemoryDeviceTokenStorageAdapter();
    const useCase = new RedeemPairingCodeUseCase(api, storage);
    await expect(useCase.execute("EXPIRED1")).rejects.toThrow(PairingCodeExpiredError);
    expect(storage.getToken()).toBeNull();
  });
});

describe("GetPairingStatusUseCase", () => {
  it("reports paired when the stored token is confirmed valid by the server", async () => {
    const storage = new InMemoryDeviceTokenStorageAdapter("some-token");
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({ tokenCheck: "valid" });
    const useCase = new GetPairingStatusUseCase(storage, api);
    await expect(useCase.execute()).resolves.toEqual({ paired: true });
  });

  it("reports unpaired and clears the stored token when the server reports it revoked", async () => {
    const storage = new InMemoryDeviceTokenStorageAdapter("revoked-token");
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({ tokenCheck: "invalid" });
    const useCase = new GetPairingStatusUseCase(storage, api);
    await expect(useCase.execute()).resolves.toEqual({ paired: false });
    expect(storage.getToken()).toBeNull();
  });

  it("reports unpaired when no token is stored, without calling the server", async () => {
    const storage = new InMemoryDeviceTokenStorageAdapter();
    const api = InMemoryLocationCredentialsApiAdapter.withSeed();
    const checkToken = vi.spyOn(api, "checkToken");
    const useCase = new GetPairingStatusUseCase(storage, api);
    await expect(useCase.execute()).resolves.toEqual({ paired: false });
    expect(checkToken).not.toHaveBeenCalled();
  });

  it("fails open and reports paired when checking the token hits a network error", async () => {
    const storage = new InMemoryDeviceTokenStorageAdapter("some-token");
    const api = InMemoryLocationCredentialsApiAdapter.withSeed({ tokenCheck: "error" });
    const useCase = new GetPairingStatusUseCase(storage, api);
    await expect(useCase.execute()).resolves.toEqual({ paired: true });
    expect(storage.getToken()).toBe("some-token");
  });
});
