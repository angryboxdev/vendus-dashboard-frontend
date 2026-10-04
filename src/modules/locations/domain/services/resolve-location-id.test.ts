import { describe, expect, it } from "vitest";
import type { LocationDTO } from "../entities/location.ts";
import { resolveLocationId } from "./resolve-location-id.ts";

const LOC_A: LocationDTO = { id: "loc-a", name: "Loja Centro", code: "CTR", timezone: "Europe/Lisbon", isActive: true, address: null, postalCode: null, city: null, municipality: null, country: "PT", phone: null };
const LOC_B: LocationDTO = { id: "loc-b", name: "Loja Norte", code: "NRT", timezone: "Europe/Lisbon", isActive: true, address: null, postalCode: null, city: null, municipality: null, country: "PT", phone: null };

describe("resolveLocationId", () => {
  it("returns the explicitly chosen id even when it has several locations to pick from", () => {
    expect(resolveLocationId("loc-b", [LOC_A, LOC_B])).toBe("loc-b");
  });

  it("implies the sole location when nothing was chosen", () => {
    expect(resolveLocationId(null, [LOC_A])).toBe("loc-a");
  });

  it("resolves to null with several locations and nothing chosen", () => {
    expect(resolveLocationId(null, [LOC_A, LOC_B])).toBeNull();
  });

  it("resolves to null with no locations and nothing chosen", () => {
    expect(resolveLocationId(null, [])).toBeNull();
  });
});

describe("resolveLocationId com locais inativos (Base Organizacional, ticket 02)", () => {
  it("ignora locais inativos ao decidir o local implícito", () => {
    expect(resolveLocationId(null, [LOC_A, { ...LOC_B, isActive: false }])).toBe("loc-a");
  });

  it("sem nenhum local ativo não há local implícito", () => {
    expect(resolveLocationId(null, [{ ...LOC_A, isActive: false }])).toBeNull();
  });
});
