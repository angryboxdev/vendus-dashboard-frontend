import { ApiError, apiGet, apiPatch, apiPostFormData } from "../../../../lib/api.ts";
import { OrganizationValidationError } from "../../domain/entities/organization-errors.ts";
import type {
  OrganizationFieldError,
  OrganizationHistoryEntry,
  OrganizationProfile,
  OrganizationProfileChanges,
} from "../../domain/entities/organization-profile.ts";
import type { OrganizationApiPort } from "../../domain/ports/out/organization-api.port.ts";

const BASE = "/api/organization";

function fieldErrorsOf(e: unknown): OrganizationFieldError[] | null {
  if (!(e instanceof ApiError) || e.status !== 400) return null;
  const data = e.data as { fieldErrors?: OrganizationFieldError[] } | undefined;
  return Array.isArray(data?.fieldErrors) ? data.fieldErrors : null;
}

export class HttpOrganizationApiAdapter implements OrganizationApiPort {
  getProfile(): Promise<OrganizationProfile> {
    return apiGet<OrganizationProfile>(BASE);
  }

  async updateProfile(changes: OrganizationProfileChanges): Promise<OrganizationProfile> {
    try {
      return await apiPatch<OrganizationProfile>(BASE, changes);
    } catch (e) {
      const fieldErrors = fieldErrorsOf(e);
      if (fieldErrors) throw new OrganizationValidationError(fieldErrors);
      throw e;
    }
  }

  uploadLogo(file: File): Promise<OrganizationProfile> {
    const formData = new FormData();
    formData.append("file", file);
    return apiPostFormData<OrganizationProfile>(`${BASE}/logo`, formData);
  }

  listHistory(): Promise<OrganizationHistoryEntry[]> {
    return apiGet<OrganizationHistoryEntry[]>(`${BASE}/history`);
  }
}
