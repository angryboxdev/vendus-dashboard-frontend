import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { CountryCatalog, LegalEntity, LegalEntityInput, LegalEntityUsage, LocationEntity } from "../../domain/entities/legal-entities.ts";
import type { LegalEntitiesApiPort } from "../../domain/ports/out/legal-entities-api.port.ts";

export class HttpLegalEntitiesApiAdapter implements LegalEntitiesApiPort {
  private readonly L = "/api/novo-rh/legal-entities";
  catalog() {
    return apiGet<CountryCatalog[]>(`${this.L}/catalog`);
  }
  list(filter: { q: string; status: "active" | "archived" | "all" }) {
    return apiGet<LegalEntity[]>(`${this.L}?${new URLSearchParams({ q: filter.q, status: filter.status }).toString()}`);
  }
  async create(input: LegalEntityInput) {
    return (await apiWrite<LegalEntity>(this.L, { body: input })).data;
  }
  async update(entity: LegalEntity, patch: Partial<LegalEntityInput>, reason: string) {
    return (await apiWrite<LegalEntity>(`${this.L}/${entity.id}`, { method: "PATCH", body: { ...patch, reason }, ifMatch: entity.etag })).data;
  }
  usage(id: string) {
    return apiGet<LegalEntityUsage>(`${this.L}/${id}/usage`);
  }
  async archive(id: string, reason: string) {
    return (await apiWrite<LegalEntity>(`${this.L}/${id}/archive`, { body: { reason } })).data;
  }
  async restore(id: string) {
    return (await apiWrite<LegalEntity>(`${this.L}/${id}/restore`, {})).data;
  }
  locations() {
    return apiGet<LocationEntity[]>(`${this.L}/locations`);
  }
  async setLocationEntity(locationId: string, legalEntityId: string | null) {
    return (await apiWrite<LocationEntity[]>(`${this.L}/locations/${locationId}`, { method: "PUT", body: { legalEntityId } })).data;
  }
}
