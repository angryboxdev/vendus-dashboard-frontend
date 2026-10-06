import { describe, expect, it } from "vitest";
import { locationFixture } from "../../adapters/out/in-memory-locations-api.adapter.ts";
import {
  EMPTY_LOCATION_FORM,
  locationHistoryLabel,
  sortLocationsForAdmin,
  toCreatePayload,
  toLocationFormValues,
  toUpdatePayload,
} from "./location-form.service.ts";

describe("location-form.service", () => {
  it("criação envia todos os campos, com opcionais vazios a null", () => {
    expect(toCreatePayload({ ...EMPTY_LOCATION_FORM, name: " Armazém " })).toEqual({
      name: "Armazém",
      code: null,
      address: null,
      postalCode: null,
      city: null,
      municipality: null,
      country: "PT",
      timezone: "Europe/Lisbon",
      phone: null,
    });
  });

  it("edição envia só os campos alterados", () => {
    const location = locationFixture({ id: "l1", name: "Mercado", code: "MBS", city: "Porto" });
    const values = { ...toLocationFormValues(location), municipality: "Porto", city: "" };

    expect(toUpdatePayload(location, values)).toEqual({ municipality: "Porto", city: null });
  });

  it("ordena ativos primeiro e depois por nome", () => {
    const sorted = sortLocationsForAdmin([
      locationFixture({ id: "1", name: "Zeta" }),
      locationFixture({ id: "2", name: "Alfa", isActive: false }),
      locationFixture({ id: "3", name: "Beta" }),
    ]);
    expect(sorted.map((l) => l.name)).toEqual(["Beta", "Zeta", "Alfa"]);
  });

  it("descreve as entradas do histórico", () => {
    const before = locationFixture({ id: "1", name: "Mercado" });
    expect(locationHistoryLabel({ id: "h", createdAt: "", actor: "a", action: "update", before, after: { ...before, city: "Porto" } })).toBe(
      "Dados alterados — Localidade",
    );
    expect(locationHistoryLabel({ id: "h", createdAt: "", actor: "a", action: "deactivate", before: null, after: null })).toBe("Local inativado");
  });
});
