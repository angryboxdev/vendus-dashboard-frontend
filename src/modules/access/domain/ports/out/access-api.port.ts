import type {
  AccessProfile,
  CreateUserInput,
  EmployeeOption,
  MyAccess,
  UpdateProfileInput,
  UpdateUserInput,
  UserDetail,
  UserListItem,
  UserStatus,
} from "../../entities/access.ts";

/** Contrato com o backend. Erros de negócio (400/409) chegam como `AccessRequestError`. */
export interface AccessApiPort {
  getMyAccess(): Promise<MyAccess>;
  listUsers(): Promise<UserListItem[]>;
  getUser(userId: string): Promise<UserDetail>;
  listEmployeeOptions(): Promise<EmployeeOption[]>;
  createUser(input: CreateUserInput): Promise<{ user: UserDetail; temporaryPassword: string }>;
  updateUser(userId: string, input: UpdateUserInput): Promise<UserDetail>;
  setUserStatus(userId: string, status: UserStatus, version: number): Promise<UserDetail>;
  resetPassword(userId: string): Promise<{ temporaryPassword: string }>;
  listProfiles(): Promise<AccessProfile[]>;
  createProfile(input: { name: string; description: string | null; baseProfileId: string | null }): Promise<AccessProfile>;
  updateProfile(profileId: string, input: UpdateProfileInput): Promise<AccessProfile>;
  setProfileActive(profileId: string, active: boolean, version: number): Promise<AccessProfile>;
}
