/** Contratos com `/api/novo-rh/structure`, `/api/novo-rh/audit`, `/api/me/notifications` e a governança de acessos. */

export interface Department {
  id: string;
  name: string;
  archived: boolean;
  etag: string;
}

export interface Group {
  id: string;
  parentId: string | null;
  code: string;
  name: string;
  color: string | null;
  description: string | null;
  hidden: boolean;
  archived: boolean;
  etag: string;
}

/** `location` = centro com vigência (transferências). */
export type UnitType = "department" | "group" | "location";

export interface Assignment {
  id: string;
  employeeId: string;
  unitType: UnitType;
  unitId: string;
  validFrom: string;
  validTo: string | null;
}

export const CONTACT_ROLES = ["primary", "billing", "communications", "technical", "onboarding"] as const;
export type ContactRole = (typeof CONTACT_ROLES)[number];

export interface Contact {
  role: ContactRole;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface TermsAcceptance {
  id: string;
  version: string;
  acceptedBy: string;
  acceptedAt: string;
  ip: string | null;
}

export type ScopeKind = "general" | "specific";
export type ScopeType = "location" | "department" | "group" | "self";

export interface AccessScope {
  id: string;
  userId: string;
  scopeType: ScopeType;
  scopeId: string | null;
  validFrom: string;
  validTo: string | null;
}

export interface FieldPrivacyRow {
  key: string;
  label: string;
  group: string;
  sensitive: boolean;
  view: boolean;
  edit: boolean;
  customized: boolean;
}

export interface ProfileGovernance {
  scopeKind: ScopeKind;
  fields: FieldPrivacyRow[];
}

export interface RoleHistoryEntry {
  at: string;
  actor: string;
  entityType: string;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
}

export interface AuditEvent {
  id: string;
  seq: number;
  occurredAt: string;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  before: unknown;
  after: unknown;
  reason: string | null;
  ip: string | null;
  userAgent: string | null;
}

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface UserOption {
  userId: string;
  label: string;
  profileId: string | null;
}

export interface ProfileOption {
  id: string;
  name: string;
  systemKey: string | null;
}
