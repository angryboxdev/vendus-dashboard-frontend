import type { LocationDTO } from "../../entities/location.ts";

export interface ListLocationsPort {
  execute(): Promise<LocationDTO[]>;
}
