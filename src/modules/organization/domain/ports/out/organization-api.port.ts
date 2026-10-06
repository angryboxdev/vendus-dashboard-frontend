import type {
  OrganizationHistoryEntry,
  OrganizationProfile,
  OrganizationProfileChanges,
} from "../../entities/organization-profile.ts";

/**
 * Contrato com o backend (`/api/organization`). `updateProfile` lança
 * `OrganizationValidationError` quando o backend devolve erros por campo.
 */
export interface OrganizationApiPort {
  getProfile(): Promise<OrganizationProfile>;
  updateProfile(changes: OrganizationProfileChanges): Promise<OrganizationProfile>;
  uploadLogo(file: File): Promise<OrganizationProfile>;
  listHistory(): Promise<OrganizationHistoryEntry[]>;
}
