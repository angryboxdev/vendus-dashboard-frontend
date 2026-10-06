import type { LocationDTO, LocationFormValues, LocationGeofence, LocationHistoryEntry } from "../../domain/entities/location.ts";
import type {
  CreateLocationPort,
  ListLocationHistoryPort,
  SetLocationActivePort,
  SetLocationGeofencePort,
  UpdateLocationPort,
} from "../../domain/ports/in/manage-locations.port.ts";
import type { LocationsApiPort } from "../../domain/ports/out/locations-api.port.ts";
import { toCreatePayload, toUpdatePayload } from "../../domain/services/location-form.service.ts";

export class CreateLocationUseCase implements CreateLocationPort {
  private readonly api: LocationsApiPort;

  constructor(api: LocationsApiPort) {
    this.api = api;
  }

  execute(values: LocationFormValues): Promise<LocationDTO> {
    return this.api.createLocation(toCreatePayload(values));
  }
}

export class UpdateLocationUseCase implements UpdateLocationPort {
  private readonly api: LocationsApiPort;

  constructor(api: LocationsApiPort) {
    this.api = api;
  }

  async execute(current: LocationDTO, values: LocationFormValues): Promise<LocationDTO> {
    const payload = toUpdatePayload(current, values);
    if (Object.keys(payload).length === 0) return current;
    return this.api.updateLocation(current.id, payload);
  }
}

export class SetLocationActiveUseCase implements SetLocationActivePort {
  private readonly api: LocationsApiPort;

  constructor(api: LocationsApiPort) {
    this.api = api;
  }

  execute(id: string, active: boolean): Promise<LocationDTO> {
    return this.api.setLocationActive(id, active);
  }
}

export class SetLocationGeofenceUseCase implements SetLocationGeofencePort {
  private readonly api: LocationsApiPort;

  constructor(api: LocationsApiPort) {
    this.api = api;
  }

  execute(id: string, geofence: LocationGeofence): Promise<LocationDTO> {
    return this.api.setLocationGeofence(id, geofence);
  }
}

export class ListLocationHistoryUseCase implements ListLocationHistoryPort {
  private readonly api: LocationsApiPort;

  constructor(api: LocationsApiPort) {
    this.api = api;
  }

  execute(id: string): Promise<LocationHistoryEntry[]> {
    return this.api.listLocationHistory(id);
  }
}
