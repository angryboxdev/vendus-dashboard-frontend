import type { LocationDTO } from "../../entities/location.ts";

export interface LocationsApiPort {
  /** Lists the caller's organization's locations (GET /api/locations). */
  listLocations(): Promise<LocationDTO[]>;
}
