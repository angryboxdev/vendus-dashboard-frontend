import { OrganizationValidationError } from "../../domain/entities/organization-errors.ts";
import type {
  OrganizationHistoryEntry,
  OrganizationProfile,
  OrganizationProfileChanges,
} from "../../domain/entities/organization-profile.ts";
import type { OrganizationApiPort } from "../../domain/ports/out/organization-api.port.ts";

/** Dados fictícios — só para testes/desenvolvimento offline. */
export function sampleOrganizationProfile(overrides: Partial<OrganizationProfile> = {}): OrganizationProfile {
  return {
    id: "org-test",
    name: "Pizzaria Exemplo",
    legalName: null,
    nif: "123456789",
    niss: null,
    address: "Rua de Teste, 1",
    postalCode: null,
    city: null,
    country: "PT",
    email: null,
    phone: null,
    website: null,
    timezone: "Europe/Lisbon",
    logoUrl: null,
    status: "active",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/**
 * Simula as regras mínimas do backend que a UI precisa de exercitar:
 * razão social obrigatória e NIF português com 9 dígitos.
 */
export class InMemoryOrganizationApiAdapter implements OrganizationApiPort {
  readonly updateCalls: OrganizationProfileChanges[] = [];
  private history: OrganizationHistoryEntry[] = [];

  constructor(private profile: OrganizationProfile = sampleOrganizationProfile()) {}

  async getProfile(): Promise<OrganizationProfile> {
    return this.profile;
  }

  async updateProfile(changes: OrganizationProfileChanges): Promise<OrganizationProfile> {
    this.updateCalls.push(changes);
    const next = { ...this.profile, ...changes } as OrganizationProfile;
    const fieldErrors = [];
    if (!next.legalName) fieldErrors.push({ field: "legalName", message: "obrigatório" });
    if (next.country === "PT" && !/^\d{9}$/.test(next.nif)) fieldErrors.push({ field: "nif", message: "NIF português inválido" });
    if (fieldErrors.length > 0) throw new OrganizationValidationError(fieldErrors);

    this.history = [
      { id: `h-${this.history.length + 1}`, createdAt: new Date().toISOString(), action: "update", actor: "admin@exemplo.pt", before: this.profile, after: next },
      ...this.history,
    ];
    this.profile = next;
    return next;
  }

  async uploadLogo(file: File): Promise<OrganizationProfile> {
    this.profile = { ...this.profile, logoUrl: `memory://${file.name}` };
    return this.profile;
  }

  async listHistory(): Promise<OrganizationHistoryEntry[]> {
    return this.history;
  }
}
