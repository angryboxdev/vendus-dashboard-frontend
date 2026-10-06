import type { LocationDTO, LocationGeofence, LocationHistoryEntry, LocationPayload } from "../../entities/location.ts";

/**
 * Contrato com `/api/locations`. As escritas lançam `LocationValidationError`
 * quando o backend devolve erros por campo (400) ou código duplicado (409).
 */
export interface LocationsApiPort {
  /** Lists the caller's organization's locations, active and inactive (GET /api/locations). */
  listLocations(): Promise<LocationDTO[]>;
  createLocation(payload: LocationPayload): Promise<LocationDTO>;
  updateLocation(id: string, payload: LocationPayload): Promise<LocationDTO>;
  setLocationActive(id: string, active: boolean): Promise<LocationDTO>;
  listLocationHistory(id: string): Promise<LocationHistoryEntry[]>;
  /** PATCH /api/locations/:id/geofence (admin). */
  setLocationGeofence(id: string, geofence: LocationGeofence): Promise<LocationDTO>;
}
