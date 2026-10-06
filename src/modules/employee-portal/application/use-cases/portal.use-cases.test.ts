import { describe, expect, it, vi } from "vitest";
import { PortalOfflineError, type ClientLocation, type PunchResult } from "../../domain/entities/portal.ts";
import type { GeolocationPort } from "../../domain/ports/out/geolocation.port.ts";
import type { PortalApiPort } from "../../domain/ports/out/portal-api.port.ts";
import { RegisterPunchUseCase } from "./portal.use-cases.ts";

const RESULT: PunchResult = {
  kind: "in",
  time: "08:58",
  serverAt: "2026-10-07T07:58:00Z",
  geofence: { status: "inside", reason: null, distanceM: 12 },
  flagged: false,
  replay: false,
};

function setup(responses: Array<PunchResult | Error>) {
  const calls: Array<{ key: string; location: ClientLocation | null }> = [];
  const api: PortalApiPort = {
    getHome: vi.fn(),
    registerPunch: vi.fn(async (_kind, key, location) => {
      calls.push({ key, location });
      const next = responses.shift()!;
      if (next instanceof Error) throw next;
      return next;
    }),
  };
  const geolocation: GeolocationPort = { readOnce: vi.fn(async () => ({ latitude: 41.1, longitude: -8.6, accuracyM: 8 })) };
  return { useCase: new RegisterPunchUseCase(api, geolocation), calls, geolocation };
}

describe("RegisterPunchUseCase", () => {
  it("com política 'off' não pede a localização", async () => {
    const { useCase, calls, geolocation } = setup([RESULT]);
    await useCase.execute({ kind: "in", geofencePolicy: "off", idempotencyKey: "k1" });
    expect(geolocation.readOnce).not.toHaveBeenCalled();
    expect(calls).toEqual([{ key: "k1", location: null }]);
  });

  it("com política ativa lê a localização UMA vez e envia-a crua", async () => {
    const { useCase, calls, geolocation } = setup([RESULT]);
    await useCase.execute({ kind: "in", geofencePolicy: "warn", idempotencyKey: "k1" });
    expect(geolocation.readOnce).toHaveBeenCalledTimes(1);
    expect(calls[0]!.location).toEqual({ latitude: 41.1, longitude: -8.6, accuracyM: 8 });
  });

  it("falha de rede: repete com a MESMA chave (o servidor não duplica)", async () => {
    const { useCase, calls } = setup([new PortalOfflineError(), { ...RESULT, replay: true }]);
    const result = await useCase.execute({ kind: "in", geofencePolicy: "off", idempotencyKey: "k1" });
    expect(calls.map((c) => c.key)).toEqual(["k1", "k1"]);
    expect(result.replay).toBe(true);
  });

  it("recusa de negócio não é repetida", async () => {
    const { useCase, calls } = setup([new Error("A entrada já está registada.")]);
    await expect(useCase.execute({ kind: "in", geofencePolicy: "off", idempotencyKey: "k1" })).rejects.toThrow("A entrada já está registada.");
    expect(calls).toHaveLength(1);
  });
});
