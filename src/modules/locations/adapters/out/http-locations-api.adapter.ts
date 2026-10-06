import { ApiError, apiGet, apiPatch, apiPost } from "../../../../lib/api.ts";
import {
  LocationValidationError,
  type LocationDTO,
  type LocationFieldError,
  type LocationGeofence,
  type LocationHistoryEntry,
  type LocationPayload,
} from "../../domain/entities/location.ts";
import type { LocationsApiPort } from "../../domain/ports/out/locations-api.port.ts";

const BASE_URL = "/api/locations";

/** 400 (validação) e 409 (código duplicado) trazem `fieldErrors` — passam a `LocationValidationError`. */
async function withFieldErrors<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (e) {
    if (e instanceof ApiError && (e.status === 400 || e.status === 409)) {
      const fieldErrors = (e.data as { fieldErrors?: LocationFieldError[] } | undefined)?.fieldErrors;
      if (Array.isArray(fieldErrors)) throw new LocationValidationError(fieldErrors);
    }
    throw e;
  }
}

/** HTTP implementation of LocationsApiPort. Uses the `src/lib/api.ts` helpers so the auth token travels. */
export class HttpLocationsApiAdapter implements LocationsApiPort {
  async listLocations(): Promise<LocationDTO[]> {
    return apiGet<LocationDTO[]>(BASE_URL);
  }

  createLocation(payload: LocationPayload): Promise<LocationDTO> {
    return withFieldErrors(() => apiPost<LocationDTO>(BASE_URL, payload));
  }

  updateLocation(id: string, payload: LocationPayload): Promise<LocationDTO> {
    return withFieldErrors(() => apiPatch<LocationDTO>(`${BASE_URL}/${id}`, payload));
  }

  setLocationGeofence(id: string, geofence: LocationGeofence): Promise<LocationDTO> {
    return withFieldErrors(() => apiPatch<LocationDTO>(`${BASE_URL}/${id}/geofence`, geofence));
  }

  setLocationActive(id: string, active: boolean): Promise<LocationDTO> {
    return apiPatch<LocationDTO>(`${BASE_URL}/${id}/active`, { active });
  }

  listLocationHistory(id: string): Promise<LocationHistoryEntry[]> {
    return apiGet<LocationHistoryEntry[]>(`${BASE_URL}/${id}/history`);
  }
}
