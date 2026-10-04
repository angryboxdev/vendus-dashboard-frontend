import type {
  OrganizationFormValues,
  OrganizationHistoryEntry,
  OrganizationProfile,
} from "../../entities/organization-profile.ts";

export interface GetOrganizationProfilePort {
  execute(): Promise<OrganizationProfile>;
}

export interface UpdateOrganizationProfilePort {
  /** Envia só os campos alterados; sem alterações devolve o perfil atual sem pedido. */
  execute(current: OrganizationProfile, values: OrganizationFormValues): Promise<OrganizationProfile>;
}

export interface UploadOrganizationLogoPort {
  /** Lança `InvalidLogoFileError` antes de qualquer pedido se o ficheiro não for aceite. */
  execute(file: File): Promise<OrganizationProfile>;
}

export interface ListOrganizationHistoryPort {
  execute(): Promise<OrganizationHistoryEntry[]>;
}
