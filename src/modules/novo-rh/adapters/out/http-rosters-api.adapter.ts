import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { Publication, PublishOptions, Roster, RosterCandidates, RosterShift, RosterSummary, ShiftInput, ShiftState, ShiftTemplate, Swap, Violation, WorkArea, CoverageReport, CoverageRule } from "../../domain/entities/rosters.ts";
import type { RostersApiPort } from "../../domain/ports/out/rosters-api.port.ts";

const R = "/api/novo-rh/rosters";
const qs = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => !!e[1])).toString();

export class HttpRostersApiAdapter implements RostersApiPort {
  listTemplates() {
    return apiGet<ShiftTemplate[]>(`${R}/templates`);
  }
  async createTemplate(input: Omit<ShiftTemplate, "id" | "archived">) {
    return (await apiWrite<ShiftTemplate>(`${R}/templates`, { body: input })).data;
  }
  async setTemplateColor(id: string, color: string | null) {
    return (await apiWrite<ShiftTemplate>(`${R}/templates/${id}/color`, { method: "PUT", body: { color } })).data;
  }
  listAreas(locationId?: string | null) {
    return apiGet<WorkArea[]>(`${R}/areas${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`);
  }
  async createArea(input: { locationId: string; name: string }) {
    return (await apiWrite<WorkArea>(`${R}/areas`, { body: input })).data;
  }
  async updateArea(id: string, patch: { name?: string; sortOrder?: number; active?: boolean }) {
    return (await apiWrite<WorkArea>(`${R}/areas/${id}`, { method: "PATCH", body: patch })).data;
  }
  coverageStatus() {
    return apiGet<{ enabled: boolean }>(`${R}/coverage/status`);
  }
  listCoverageRules(locationId: string) {
    return apiGet<CoverageRule[]>(`${R}/coverage/rules?locationId=${encodeURIComponent(locationId)}`);
  }
  async createCoverageRule(input: Omit<CoverageRule, "id">) {
    return (await apiWrite<CoverageRule>(`${R}/coverage/rules`, { body: input })).data;
  }
  async updateCoverageRule(id: string, patch: { start?: string; end?: string; minPeople?: number }) {
    return (await apiWrite<CoverageRule>(`${R}/coverage/rules/${id}`, { method: "PATCH", body: patch })).data;
  }
  async deleteCoverageRule(id: string) {
    await apiWrite(`${R}/coverage/rules/${id}`, { method: "DELETE" });
  }
  coverage(rosterId: string, from: string, to: string) {
    return apiGet<CoverageReport>(`${R}/${rosterId}/coverage?from=${from}&to=${to}`);
  }
  async archiveTemplate(id: string) {
    await apiWrite(`${R}/templates/${id}/archive`, {});
  }
  async clearPending(rosterId: string, input: { employeeId: string; from: string; to: string; shiftIds?: string[] }) {
    return (await apiWrite<{ removed: RosterShift[] }>(`${R}/${rosterId}/clear-pending`, { body: input })).data;
  }
  async restoreShifts(rosterId: string, shiftIds: string[]) {
    return (await apiWrite<{ restored: RosterShift[]; warnings: Violation[] }>(`${R}/${rosterId}/shifts/restore`, { body: { shiftIds } })).data;
  }
  listRosters() {
    return apiGet<Roster[]>(R);
  }
  summary(from: string, to: string) {
    return apiGet<RosterSummary[]>(`${R}/summary?${qs({ from, to })}`);
  }
  async createRoster(input: Pick<Roster, "name" | "targetType" | "targetId">) {
    return (await apiWrite<Roster>(R, { body: input })).data;
  }
  listShifts(rosterId: string, from: string, to: string) {
    return apiGet<{ roster: Roster; pending: number; shifts: RosterShift[] }>(`${R}/${rosterId}/shifts?${qs({ from, to })}`);
  }
  async addShift(rosterId: string, input: ShiftInput) {
    return (await apiWrite<{ shift: RosterShift; warnings: Violation[] }>(`${R}/${rosterId}/shifts`, { body: input })).data;
  }
  async assignBulk(rosterId: string, input: { employeeIds: string[]; from: string; to: string; weekdays: string[]; kind: "shift" | "day_off"; templateId: string | null }) {
    return (await apiWrite<{ created: number; warnings: Violation[] }>(`${R}/${rosterId}/shifts/bulk`, { body: input })).data;
  }
  async updateShift(id: string, patch: Partial<ShiftInput>, opts: PublishOptions) {
    return (await apiWrite<{ shift: RosterShift; warnings: Violation[]; publication: Publication | null }>(`${R}/shifts/${id}`, { method: "PATCH", body: { ...patch, ...opts } })).data;
  }
  async deleteShift(id: string, opts: PublishOptions) {
    return (await apiWrite<{ publication: Publication | null }>(`${R}/shifts/${id}/delete`, { body: opts })).data;
  }
  check(rosterId: string, period?: { from: string; to: string }) {
    return apiGet<{ pending: number; violations: Violation[] }>(`${R}/${rosterId}/check${period ? `?from=${period.from}&to=${period.to}` : ""}`);
  }
  candidates(rosterId: string, from: string, to: string) {
    return apiGet<RosterCandidates>(`${R}/${rosterId}/candidates?from=${from}&to=${to}`);
  }
  async publish(rosterId: string, opts: PublishOptions) {
    return (await apiWrite<Publication>(`${R}/${rosterId}/publish`, { body: opts })).data;
  }
  history(rosterId: string) {
    return apiGet<Publication[]>(`${R}/${rosterId}/history`);
  }
  listSwaps(status?: Swap["status"]) {
    return apiGet<Swap[]>(`${R}/swaps?${qs({ status })}`);
  }
  async decideSwap(id: string, decision: "approve" | "reject", comment: string | null, confirm: boolean) {
    return (await apiWrite<Swap>(`${R}/swaps/${id}/decide`, { body: { decision, comment, confirm } })).data;
  }
  myRoster(from: string, to: string) {
    return apiGet<{ employeeId: string; shifts: (ShiftState & { id: string; rosterId: string })[] }>(`/api/me/roster?${qs({ from, to })}`);
  }
  mySwaps() {
    return apiGet<Swap[]>("/api/me/roster/swaps");
  }
  async requestSwap(input: { shiftId: string; targetEmployeeId: string; counterShiftId: string | null; comment: string | null }) {
    return (await apiWrite<Swap>("/api/me/roster/swaps", { body: input })).data;
  }
  async respondSwap(id: string, accept: boolean) {
    return (await apiWrite<Swap>(`/api/me/roster/swaps/${id}/respond`, { body: { accept } })).data;
  }
}
