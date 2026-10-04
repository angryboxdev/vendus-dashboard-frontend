import type { LocationDTO, LocationFormValues, LocationHistoryEntry } from "../../domain/entities/location.ts";
import type {
  CreateLocationPort,
  ListLocationHistoryPort,
  SetLocationActivePort,
  UpdateLocationPort,
} from "../../domain/ports/in/manage-locations.port.ts";
import type { LocationsApiPort } from "../../domain/ports/out/locations-api.port.ts";
import { toCreatePayload, toUpdatePayload } from "../../domain/services/location-form.service.ts";

export class CreateLocationUseCase implements CreateLocationPort {
  constructor(private readonly api: LocationsApiPort) {}

  execute(values: LocationFormValues): Promise<LocationDTO> {
    return this.api.createLocation(toCreatePayload(values));
  }
}

export class UpdateLocationUseCase implements UpdateLocationPort {
  constructor(private readonly api: LocationsApiPort) {}

  async execute(current: LocationDTO, values: LocationFormValues): Promise<LocationDTO> {
    const payload = toUpdatePayload(current, values);
    if (Object.keys(payload).length === 0) return current;
    return this.api.updateLocation(current.id, payload);
  }
}

export class SetLocationActiveUseCase implements SetLocationActivePort {
  constructor(private readonly api: LocationsApiPort) {}

  execute(id: string, active: boolean): Promise<LocationDTO> {
    return this.api.setLocationActive(id, active);
  }
}

export class ListLocationHistoryUseCase implements ListLocationHistoryPort {
  constructor(private readonly api: LocationsApiPort) {}

  execute(id: string): Promise<LocationHistoryEntry[]> {
    return this.api.listLocationHistory(id);
  }
}
