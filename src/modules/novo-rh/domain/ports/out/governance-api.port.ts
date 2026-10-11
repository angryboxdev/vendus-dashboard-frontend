import type {
  AccessScope,
  AppNotification,
  Assignment,
  AuditEvent,
  Contact,
  ContactRole,
  Department,
  Group,
  ProfileGovernance,
  ProfileOption,
  RoleHistoryEntry,
  ScopeKind,
  ScopeType,
  TermsAcceptance,
  UnitType,
  UserOption,
} from "../../entities/governance.ts";

export interface GroupInput {
  parentId: string | null;
  code: string;
  name: string;
  color: string | null;
  description: string | null;
  hidden: boolean;
}

/** Novo RH → Estrutura. */
export interface StructureApiPort {
  listDepartments(): Promise<Department[]>;
  createDepartment(name: string): Promise<Department>;
  updateDepartment(d: Department, patch: { name?: string; archived?: boolean }): Promise<Department>;
  listGroups(): Promise<Group[]>;
  createGroup(input: GroupInput): Promise<Group>;
  updateGroup(g: Group, patch: Partial<GroupInput> & { archived?: boolean }): Promise<Group>;
  listAssignments(employeeId: string): Promise<Assignment[]>;
  assign(input: { employeeId: string; unitType: UnitType; unitId: string; validFrom: string; validTo: string | null }): Promise<Assignment>;
  endAssignment(id: string, validTo: string): Promise<Assignment>;
  listContacts(): Promise<Contact[]>;
  setContact(role: ContactRole, input: { name: string; email: string | null; phone: string | null }): Promise<Contact>;
  listTerms(): Promise<TermsAcceptance[]>;
  acceptTerms(version: string): Promise<TermsAcceptance>;
}

/** Novo RH → Acessos (tipo de perfil, âmbitos, privacidade, histórico). */
export interface AccessGovernanceApiPort {
  listProfiles(): Promise<ProfileOption[]>;
  listUsers(): Promise<UserOption[]>;
  profileGovernance(profileId: string): Promise<ProfileGovernance>;
  setScopeKind(profileId: string, kind: ScopeKind): Promise<ProfileGovernance>;
  setFieldPrivacy(profileId: string, rules: { fieldKey: string; canView: boolean; canEdit: boolean }[]): Promise<ProfileGovernance>;
  listScopes(userId: string): Promise<AccessScope[]>;
  addScope(userId: string, input: { scopeType: ScopeType; scopeId: string | null; validFrom: string; validTo: string | null }): Promise<AccessScope>;
  endScope(userId: string, scopeId: string, validTo: string): Promise<AccessScope>;
  roleHistory(): Promise<RoleHistoryEntry[]>;
  downloadRoleHistoryCsv(): Promise<Blob>;
}

/** Novo RH → Auditoria. */
export interface AuditApiPort {
  list(filter: { resourceType?: string; from?: string; to?: string }): Promise<AuditEvent[]>;
  downloadCsv(filter: { resourceType?: string; from?: string; to?: string }): Promise<Blob>;
  verify(): Promise<{ intact: boolean; brokenAtSeq: number | null }>;
}

/** As minhas notificações. */
export interface NotificationsApiPort {
  list(): Promise<AppNotification[]>;
  unreadCount(): Promise<number>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}
