import type { LocationDTO } from "../../domain/entities/location.ts";
import type { ListLocationsPort } from "../../domain/ports/in/list-locations.port.ts";
import type { LocationsApiPort } from "../../domain/ports/out/locations-api.port.ts";

export class ListLocationsUseCase implements ListLocationsPort {
  private readonly api: LocationsApiPort;

  constructor(api: LocationsApiPort) {
    this.api = api;
  }

  execute(): Promise<LocationDTO[]> {
    return this.api.listLocations();
  }
}
