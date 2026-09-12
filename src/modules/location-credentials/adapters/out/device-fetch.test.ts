import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deviceFetch } from "./device-fetch.ts";

const STORAGE_KEY = "angrybox.deviceToken";

describe("deviceFetch", () => {
  beforeEach(() => {
    window.localStorage.setItem(STORAGE_KEY, "some-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("adds the X-Device-Token header from storage", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await deviceFetch("/api/kds/deliveries");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/kds/deliveries",
      expect.objectContaining({ headers: expect.objectContaining({ "X-Device-Token": "some-token" }) }),
    );
  });

  it("does not clear the stored token on a 401 matching the device-auth message", async () => {
    const body = JSON.stringify({ error: "Invalid or missing device credentials" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 401 })));
    await deviceFetch("/api/kds/deliveries");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("some-token");
  });

  it("does not reload the page on a 401 matching the device-auth message", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const body = JSON.stringify({ error: "Invalid or missing device credentials" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 401 })));
    await deviceFetch("/api/kds/deliveries");
    expect(reload).not.toHaveBeenCalled();
  });

  it("returns the 401 response unchanged to the caller", async () => {
    const body = JSON.stringify({ error: "Invalid or missing device credentials" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 401 })));
    const res = await deviceFetch("/api/kds/deliveries");
    expect(res.status).toBe(401);
    expect(res.ok).toBe(false);
  });

  it("does not clear the token or reload on an unrelated 401 (e.g. wrong PIN)", async () => {
    const body = JSON.stringify({ error: "Invalid PIN" });
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { status: 401 })));
    await deviceFetch("/api/verify-pin");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("some-token");
    expect(reload).not.toHaveBeenCalled();
  });
});
