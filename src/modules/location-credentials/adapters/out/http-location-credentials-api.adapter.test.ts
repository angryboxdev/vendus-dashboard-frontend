import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpLocationCredentialsApiAdapter } from "./http-location-credentials-api.adapter.ts";

const STORAGE_KEY = "angrybox.deviceToken";

describe("HttpLocationCredentialsApiAdapter.checkToken", () => {
  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEY, "some-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("resolves true on 200", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
    const adapter = new HttpLocationCredentialsApiAdapter();
    await expect(adapter.checkToken()).resolves.toBe(true);
  });

  it("resolves false on 401 (requireDeviceAuth confirming the token is missing/unknown/revoked)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    const adapter = new HttpLocationCredentialsApiAdapter();
    await expect(adapter.checkToken()).resolves.toBe(false);
  });

  it.each([500, 502, 503])(
    "throws on %d instead of resolving false, so a transient failure doesn't look like a confirmed-invalid token",
    async (status) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status })));
      const adapter = new HttpLocationCredentialsApiAdapter();
      await expect(adapter.checkToken()).rejects.toThrow();
    },
  );
});
