import type { LocationDTO } from "../../domain/entities/location.ts";
import type { LocationsApiPort } from "../../domain/ports/out/locations-api.port.ts";

/** Fake LocationsApiPort for use-case and UI tests — no network. */
export class InMemoryLocationsApiAdapter implements LocationsApiPort {
  private readonly seed: LocationDTO[];

  constructor(seed: LocationDTO[] = []) {
    this.seed = seed;
  }

  static withSeed(seed: LocationDTO[]): InMemoryLocationsApiAdapter {
    return new InMemoryLocationsApiAdapter(seed);
  }

  async listLocations(): Promise<LocationDTO[]> {
    return this.seed;
  }
}
