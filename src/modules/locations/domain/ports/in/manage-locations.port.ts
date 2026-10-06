import type { LocationDTO, LocationFormValues, LocationGeofence, LocationHistoryEntry } from "../../entities/location.ts";

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

export interface SetLocationGeofencePort {
  execute(id: string, geofence: LocationGeofence): Promise<LocationDTO>;
}

/** Leitura única da posição deste dispositivo (para "Usar a minha localização atual" no Local). */
export interface ReadCurrentPositionPort {
  execute(): Promise<{ latitude: number; longitude: number; accuracyM: number }>;
}

export interface ListLocationHistoryPort {
  execute(id: string): Promise<LocationHistoryEntry[]>;
}
