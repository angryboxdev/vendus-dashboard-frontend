import { apiGet, apiGetBlob, apiPost, apiWrite } from "../../../../lib/api.ts";
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
} from "../../domain/entities/governance.ts";
import type { AccessGovernanceApiPort, AuditApiPort, GroupInput, NotificationsApiPort, StructureApiPort } from "../../domain/ports/out/governance-api.port.ts";

const S = "/api/novo-rh/structure";
const qs = (o: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
};

export class HttpStructureApiAdapter implements StructureApiPort {
  listDepartments() {
    return apiGet<Department[]>(`${S}/departments`);
  }
  async createDepartment(name: string) {
    return (await apiWrite<Department>(`${S}/departments`, { body: { name } })).data;
  }
  async updateDepartment(d: Department, patch: { name?: string; archived?: boolean }) {
    return (await apiWrite<Department>(`${S}/departments/${d.id}`, { method: "PATCH", body: patch, ifMatch: d.etag })).data;
  }
  listGroups() {
    return apiGet<Group[]>(`${S}/groups`);
  }
  async createGroup(input: GroupInput) {
    return (await apiWrite<Group>(`${S}/groups`, { body: input })).data;
  }
  async updateGroup(g: Group, patch: Partial<GroupInput> & { archived?: boolean }) {
    return (await apiWrite<Group>(`${S}/groups/${g.id}`, { method: "PATCH", body: patch, ifMatch: g.etag })).data;
  }
  listAssignments(employeeId: string) {
    return apiGet<Assignment[]>(`${S}/assignments${qs({ employeeId })}`);
  }
  listAllAssignments() {
    return apiGet<Assignment[]>(`${S}/assignments`);
  }
  async assign(input: { employeeId: string; unitType: UnitType; unitId: string; validFrom: string; validTo: string | null }) {
    return (await apiWrite<Assignment>(`${S}/assignments`, { body: input })).data;
  }
  async endAssignment(id: string, validTo: string) {
    return (await apiWrite<Assignment>(`${S}/assignments/${id}/end`, { body: { validTo } })).data;
  }
  listContacts() {
    return apiGet<Contact[]>(`${S}/contacts`);
  }
  async setContact(role: ContactRole, input: { name: string; email: string | null; phone: string | null }) {
    return (await apiWrite<Contact>(`${S}/contacts/${role}`, { method: "PUT", body: input })).data;
  }
  listTerms() {
    return apiGet<TermsAcceptance[]>(`${S}/terms`);
  }
  async acceptTerms(version: string) {
    return (await apiWrite<TermsAcceptance>(`${S}/terms/accept`, { body: { version } })).data;
  }
}

export class HttpAccessGovernanceApiAdapter implements AccessGovernanceApiPort {
  async listProfiles(): Promise<ProfileOption[]> {
    const rows = await apiGet<{ id: string; name: string; systemKey: string | null }[]>("/api/access-profiles");
    return rows.map((p) => ({ id: p.id, name: p.name, systemKey: p.systemKey }));
  }
  async listUsers(): Promise<UserOption[]> {
    const rows = await apiGet<{ userId: string; displayName: string; email: string; profile: { id: string | null } }[]>("/api/users");
    return rows.map((u) => ({ userId: u.userId, label: u.displayName || u.email, profileId: u.profile.id }));
  }
  profileGovernance(profileId: string) {
    return apiGet<ProfileGovernance>(`/api/access-profiles/${profileId}/governance`);
  }
  async setScopeKind(profileId: string, kind: ScopeKind) {
    return (await apiWrite<ProfileGovernance>(`/api/access-profiles/${profileId}/scope-kind`, { method: "PUT", body: { scopeKind: kind } })).data;
  }
  async setFieldPrivacy(profileId: string, rules: { fieldKey: string; canView: boolean; canEdit: boolean }[]) {
    return (await apiWrite<ProfileGovernance>(`/api/access-profiles/${profileId}/field-privacy`, { method: "PUT", body: { rules } })).data;
  }
  listScopes(userId: string) {
    return apiGet<AccessScope[]>(`/api/users/${userId}/scopes`);
  }
  async addScope(userId: string, input: { scopeType: ScopeType; scopeId: string | null; validFrom: string; validTo: string | null }) {
    return (await apiWrite<AccessScope>(`/api/users/${userId}/scopes`, { body: input })).data;
  }
  async endScope(userId: string, scopeId: string, validTo: string) {
    return (await apiWrite<AccessScope>(`/api/users/${userId}/scopes/${scopeId}/end`, { body: { validTo } })).data;
  }
  roleHistory() {
    return apiGet<RoleHistoryEntry[]>("/api/access-profiles/history");
  }
  downloadRoleHistoryCsv() {
    return apiGetBlob("/api/access-profiles/history.csv");
  }
}

export class HttpAuditApiAdapter implements AuditApiPort {
  list(filter: { resourceType?: string; resourceId?: string; from?: string; to?: string }) {
    return apiGet<AuditEvent[]>(`/api/novo-rh/audit/events${qs({ ...filter, limit: "200" })}`);
  }
  downloadCsv(filter: { resourceType?: string; from?: string; to?: string }) {
    return apiGetBlob(`/api/novo-rh/audit/events.csv${qs({ ...filter, limit: "1000" })}`);
  }
  verify() {
    return apiGet<{ intact: boolean; brokenAtSeq: number | null }>("/api/novo-rh/audit/verify");
  }
}

export class HttpNotificationsApiAdapter implements NotificationsApiPort {
  list(options: { unreadOnly?: boolean; limit?: number } = {}) {
    return apiGet<AppNotification[]>(`/api/me/notifications?limit=${options.limit ?? 30}${options.unreadOnly ? "&unread=1" : ""}`);
  }
  async unreadCount() {
    return (await apiGet<{ count: number }>("/api/me/notifications/unread-count")).count;
  }
  async markRead(id: string) {
    await apiPost(`/api/me/notifications/${id}/read`, {});
  }
  async markAllRead() {
    await apiPost("/api/me/notifications/read-all", {});
  }
}
