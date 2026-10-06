import { ApiError, apiGet, apiPatch, apiPost } from "../../../../lib/api.ts";
import {
  AccessRequestError,
  type AccessProfile,
  type CreateUserInput,
  type EmployeeOption,
  type MyAccess,
  type UpdateProfileInput,
  type UpdateUserInput,
  type UserDetail,
  type UserListItem,
  type UserStatus,
} from "../../domain/entities/access.ts";
import type { AccessApiPort } from "../../domain/ports/out/access-api.port.ts";

async function call<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (e) {
    if (e instanceof ApiError && (e.status === 400 || e.status === 409)) {
      throw new AccessRequestError(e.message, ((e.data ?? {}) as { code?: string }).code ?? null);
    }
    throw e;
  }
}

const enc = encodeURIComponent;

export class HttpAccessApiAdapter implements AccessApiPort {
  getMyAccess(): Promise<MyAccess> {
    return apiGet<MyAccess>("/api/me/access");
  }
  listUsers(): Promise<UserListItem[]> {
    return apiGet<UserListItem[]>("/api/users");
  }
  getUser(userId: string): Promise<UserDetail> {
    return apiGet<UserDetail>(`/api/users/${enc(userId)}`);
  }
  listEmployeeOptions(): Promise<EmployeeOption[]> {
    return apiGet<EmployeeOption[]>("/api/users/employee-options");
  }
  createUser(input: CreateUserInput) {
    return call(() => apiPost<{ user: UserDetail; temporaryPassword: string }>("/api/users", input));
  }
  updateUser(userId: string, input: UpdateUserInput) {
    return call(() => apiPatch<UserDetail>(`/api/users/${enc(userId)}`, input));
  }
  setUserStatus(userId: string, status: UserStatus, version: number) {
    return call(() => apiPatch<UserDetail>(`/api/users/${enc(userId)}/status`, { status, version }));
  }
  resetPassword(userId: string) {
    return call(() => apiPost<{ temporaryPassword: string }>(`/api/users/${enc(userId)}/reset-password`, {}));
  }
  listProfiles(): Promise<AccessProfile[]> {
    return apiGet<AccessProfile[]>("/api/access-profiles");
  }
  createProfile(input: { name: string; description: string | null; baseProfileId: string | null }) {
    return call(() => apiPost<AccessProfile>("/api/access-profiles", input));
  }
  updateProfile(profileId: string, input: UpdateProfileInput) {
    return call(() => apiPatch<AccessProfile>(`/api/access-profiles/${enc(profileId)}`, input));
  }
  setProfileActive(profileId: string, active: boolean, version: number) {
    return call(() => apiPatch<AccessProfile>(`/api/access-profiles/${enc(profileId)}/active`, { active, version }));
  }
}
