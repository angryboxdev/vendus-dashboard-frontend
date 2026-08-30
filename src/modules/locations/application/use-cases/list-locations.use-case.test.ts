import { describe, expect, it } from "vitest";
import { InMemoryLocationsApiAdapter } from "../../adapters/out/in-memory-locations-api.adapter.ts";
import { ListLocationsUseCase } from "./list-locations.use-case.ts";

describe("ListLocationsUseCase", () => {
  it("returns no locations when the organization has none seeded", async () => {
    const useCase = new ListLocationsUseCase(InMemoryLocationsApiAdapter.withSeed([]));
    expect(await useCase.execute()).toEqual([]);
  });

  it("returns all of the organization's locations", async () => {
    const useCase = new ListLocationsUseCase(
      InMemoryLocationsApiAdapter.withSeed([
        { id: "1", name: "Loja Centro", code: "CTR", timezone: "Europe/Lisbon", isActive: true },
        { id: "2", name: "Loja Norte", code: "NRT", timezone: "Europe/Lisbon", isActive: true },
      ]),
    );
    const result = await useCase.execute();
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("Loja Centro");
  });
});
