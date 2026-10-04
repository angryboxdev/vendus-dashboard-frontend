import { InvalidLogoFileError } from "../../domain/entities/organization-errors.ts";
import type {
  OrganizationFormValues,
  OrganizationHistoryEntry,
  OrganizationProfile,
} from "../../domain/entities/organization-profile.ts";
import type {
  GetOrganizationProfilePort,
  ListOrganizationHistoryPort,
  UpdateOrganizationProfilePort,
  UploadOrganizationLogoPort,
} from "../../domain/ports/in/organization.ports.ts";
import type { OrganizationApiPort } from "../../domain/ports/out/organization-api.port.ts";
import { diffChanges, hasChanges, validateLogoFile } from "../../domain/services/organization-form.service.ts";

export class GetOrganizationProfileUseCase implements GetOrganizationProfilePort {
  constructor(private readonly api: OrganizationApiPort) {}

  execute(): Promise<OrganizationProfile> {
    return this.api.getProfile();
  }
}

export class UpdateOrganizationProfileUseCase implements UpdateOrganizationProfilePort {
  constructor(private readonly api: OrganizationApiPort) {}

  async execute(current: OrganizationProfile, values: OrganizationFormValues): Promise<OrganizationProfile> {
    const changes = diffChanges(current, values);
    if (!hasChanges(changes)) return current;
    return this.api.updateProfile(changes);
  }
}

export class UploadOrganizationLogoUseCase implements UploadOrganizationLogoPort {
  constructor(private readonly api: OrganizationApiPort) {}

  async execute(file: File): Promise<OrganizationProfile> {
    const error = validateLogoFile(file);
    if (error) throw new InvalidLogoFileError(error);
    return this.api.uploadLogo(file);
  }
}

export class ListOrganizationHistoryUseCase implements ListOrganizationHistoryPort {
  constructor(private readonly api: OrganizationApiPort) {}

  execute(): Promise<OrganizationHistoryEntry[]> {
    return this.api.listHistory();
  }
}
