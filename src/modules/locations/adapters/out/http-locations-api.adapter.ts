import { apiGet } from "../../../../lib/api.ts";
import type { LocationDTO } from "../../domain/entities/location.ts";
import type { LocationsApiPort } from "../../domain/ports/out/locations-api.port.ts";

const BASE_URL = "/api/locations";

/** HTTP implementation of LocationsApiPort. Uses apiGet so the auth token travels. */
export class HttpLocationsApiAdapter implements LocationsApiPort {
  async listLocations(): Promise<LocationDTO[]> {
    return apiGet<LocationDTO[]>(BASE_URL);
  }
}
