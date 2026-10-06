/**
 * Utilizadores & Perfis de Acesso 2.0 — contrato com o backend (módulo
 * `access`): `/api/me/access`, `/api/users*`, `/api/access-profiles*`.
 * O catálogo (módulos, funcionalidades, permissões especiais) vem do
 * backend — nunca se escrevem chaves de permissão soltas no frontend.
 */

export type AccessLevel = "NONE" | "READ" | "MANAGE";
export type PermissionMap = Record<string, AccessLevel>;
export type SystemProfileKey = "admin" | "manager" | "rh" | "financeiro" | "colaborador";

export interface CatalogItem {
  key: string;
  label: string;
  description: string;
}

export interface CatalogModule extends CatalogItem {
  functions: CatalogItem[];
  specials: CatalogItem[];
}

export type ModuleState = "none" | "read_all" | "manage_all" | "mixed";

export interface ModuleSummary {
  moduleKey: string;
  label: string;
  state: ModuleState;
  granted: number;
  total: number;
  customized: boolean;
}

export interface ProfileRef {
  id: string | null;
  name: string;
  systemKey: SystemProfileKey | null;
}

/** Acesso efetivo do utilizador autenticado. */
export interface MyAccess {
  profile: ProfileRef;
  isAdmin: boolean;
  portalOnly: boolean;
  permissions: PermissionMap;
  modules: ModuleSummary[];
  catalog: CatalogModule[];
}

export type UserStatus = "active" | "disabled";

export interface UserListItem {
  userId: string;
  email: string;
  displayName: string;
  profile: ProfileRef;
  status: UserStatus;
  lastSignInAt: string | null;
  employee: { id: string; fullName: string } | null;
  isAdmin: boolean;
  portalOnly: boolean;
  modules: ModuleSummary[];
  overridesCount: number;
  version: number;
}

export interface UserDetail extends UserListItem {
  permissions: PermissionMap;
  overrides: PermissionMap;
  profilePermissions: PermissionMap;
}

export interface AccessProfile {
  id: string;
  systemKey: SystemProfileKey | null;
  name: string;
  description: string | null;
  isProtected: boolean;
  active: boolean;
  permissions: PermissionMap;
  userCount: number;
  version: number;
}

export interface EmployeeOption {
  id: string;
  fullName: string;
  linkedUserId: string | null;
}

export interface CreateUserInput {
  email: string;
  profileId: string;
  employeeId: string | null;
}

export interface UpdateUserInput {
  version: number;
  profileId?: string;
  overrides?: PermissionMap;
  employeeId?: string | null;
}

export interface UpdateProfileInput {
  version: number;
  name?: string;
  description?: string | null;
  permissions?: PermissionMap;
}

/** Erro de negócio vindo do backend (400/409) — a mensagem já vem em PT-PT. */
export class AccessRequestError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = "AccessRequestError";
    this.code = code;
  }
}
