import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { Publication, PublishOptions, Roster, RosterShift, RosterSummary, ShiftInput, ShiftState, ShiftTemplate, Swap, Violation } from "../../domain/entities/rosters.ts";
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
  check(rosterId: string) {
    return apiGet<{ pending: number; violations: Violation[] }>(`${R}/${rosterId}/check`);
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
