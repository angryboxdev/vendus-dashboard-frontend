import { LocationValidationError, type LocationDTO, type LocationHistoryEntry, type LocationPayload } from "../../domain/entities/location.ts";
import type { LocationsApiPort } from "../../domain/ports/out/locations-api.port.ts";

/** Local fictício completo para testes — só `id`/`name` costumam importar. */
export function locationFixture(overrides: Partial<LocationDTO> & Pick<LocationDTO, "id" | "name">): LocationDTO {
  return {
    code: null,
    timezone: "Europe/Lisbon",
    isActive: true,
    address: null,
    postalCode: null,
    city: null,
    municipality: null,
    country: "PT",
    phone: null,
    ...overrides,
  };
}

/**
 * Fake LocationsApiPort for use-case and UI tests — no network. Simula as
 * regras do backend que a UI precisa de exercitar: nome obrigatório e
 * código único por organização.
 */
export class InMemoryLocationsApiAdapter implements LocationsApiPort {
  private locations: LocationDTO[];
  private history = new Map<string, LocationHistoryEntry[]>();
  readonly updateCalls: { id: string; payload: LocationPayload }[] = [];

  constructor(seed: LocationDTO[] = []) {
    this.locations = [...seed];
  }

  static withSeed(seed: LocationDTO[]): InMemoryLocationsApiAdapter {
    return new InMemoryLocationsApiAdapter(seed);
  }

  async listLocations(): Promise<LocationDTO[]> {
    return this.locations;
  }

  private validate(candidate: LocationDTO): void {
    const errors = [];
    if (!candidate.name.trim()) errors.push({ field: "name", message: "obrigatório" });
    if (candidate.code && this.locations.some((l) => l.id !== candidate.id && l.code === candidate.code)) {
      errors.push({ field: "code", message: "já usado noutro local" });
    }
    if (errors.length > 0) throw new LocationValidationError(errors);
  }

  private log(id: string, action: string, before: unknown, after: unknown): void {
    const entry = { id: `h-${Date.now()}-${Math.random()}`, createdAt: new Date().toISOString(), action, actor: "admin@exemplo.pt", before, after };
    this.history.set(id, [entry, ...(this.history.get(id) ?? [])]);
  }

  async createLocation(payload: LocationPayload): Promise<LocationDTO> {
    const created = locationFixture({ id: `loc-${this.locations.length + 1}`, name: "", ...(payload as Partial<LocationDTO>) });
    this.validate(created);
    this.locations = [...this.locations, created];
    this.log(created.id, "create", null, created);
    return created;
  }

  async updateLocation(id: string, payload: LocationPayload): Promise<LocationDTO> {
    this.updateCalls.push({ id, payload });
    const current = this.locations.find((l) => l.id === id)!;
    const updated = { ...current, ...(payload as Partial<LocationDTO>) };
    this.validate(updated);
    this.locations = this.locations.map((l) => (l.id === id ? updated : l));
    this.log(id, "update", current, updated);
    return updated;
  }

  async setLocationActive(id: string, active: boolean): Promise<LocationDTO> {
    const current = this.locations.find((l) => l.id === id)!;
    const updated = { ...current, isActive: active };
    this.locations = this.locations.map((l) => (l.id === id ? updated : l));
    this.log(id, active ? "activate" : "deactivate", { isActive: current.isActive }, { isActive: active });
    return updated;
  }

  async listLocationHistory(id: string): Promise<LocationHistoryEntry[]> {
    return this.history.get(id) ?? [];
  }
}
