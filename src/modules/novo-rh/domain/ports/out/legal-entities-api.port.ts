import type { CountryCatalog, LegalEntity, LegalEntityInput, LegalEntityUsage, LocationEntity } from "../../entities/legal-entities.ts";

/** Entidades legais (`/api/novo-rh/legal-entities`). */
export interface LegalEntitiesApiPort {
  catalog(): Promise<CountryCatalog[]>;
  list(filter: { q: string; status: "active" | "archived" | "all" }): Promise<LegalEntity[]>;
  create(input: LegalEntityInput): Promise<LegalEntity>;
  /** `If-Match` com a versão lida; motivo obrigatório. */
  update(entity: LegalEntity, patch: Partial<LegalEntityInput>, reason: string): Promise<LegalEntity>;
  usage(id: string): Promise<LegalEntityUsage>;
  archive(id: string, reason: string): Promise<LegalEntity>;
  restore(id: string): Promise<LegalEntity>;
  locations(): Promise<LocationEntity[]>;
  setLocationEntity(locationId: string, legalEntityId: string | null): Promise<LocationEntity[]>;
}
