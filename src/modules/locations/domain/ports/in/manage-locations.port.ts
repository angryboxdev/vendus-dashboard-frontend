import type { LocationDTO, LocationFormValues, LocationHistoryEntry } from "../../entities/location.ts";

export interface CreateLocationPort {
  execute(values: LocationFormValues): Promise<LocationDTO>;
}

export interface UpdateLocationPort {
  /** Envia só os campos alterados; sem alterações devolve o local atual sem pedido. */
  execute(current: LocationDTO, values: LocationFormValues): Promise<LocationDTO>;
}

export interface SetLocationActivePort {
  execute(id: string, active: boolean): Promise<LocationDTO>;
}

export interface ListLocationHistoryPort {
  execute(id: string): Promise<LocationHistoryEntry[]>;
}
