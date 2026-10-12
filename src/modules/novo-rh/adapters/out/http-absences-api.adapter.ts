import { apiGet, apiWrite } from "../../../../lib/api.ts";
import type { AbsenceRequest, AbsenceType, AbsenceTypeInput, ApprovalFlow, ApprovalFlowInput, Balance, RequestInput, RequestStatus } from "../../domain/entities/absences.ts";
import type { AbsencesApiPort, MyAbsencesApiPort } from "../../domain/ports/out/absences-api.port.ts";

const A = "/api/novo-rh/absences";
const qs = (o: Record<string, string | undefined>) => new URLSearchParams(Object.entries(o).filter((e): e is [string, string] => !!e[1])).toString();

export class HttpAbsencesApiAdapter implements AbsencesApiPort {
  listTypes() {
    return apiGet<AbsenceType[]>(`${A}/types`);
  }
  async createType(input: AbsenceTypeInput) {
    return (await apiWrite<AbsenceType>(`${A}/types`, { body: input })).data;
  }
  async updateType(id: string, input: AbsenceTypeInput) {
    return (await apiWrite<AbsenceType>(`${A}/types/${id}`, { method: "PUT", body: input })).data;
  }
  async archiveType(id: string) {
    await apiWrite(`${A}/types/${id}/archive`, {});
  }
  listFlows() {
    return apiGet<ApprovalFlow[]>(`${A}/flows`);
  }
  async createFlow(input: ApprovalFlowInput) {
    return (await apiWrite<ApprovalFlow>(`${A}/flows`, { body: input })).data;
  }
  async archiveFlow(id: string) {
    await apiWrite(`${A}/flows/${id}/archive`, {});
  }
  listRequests(f: { status?: RequestStatus; employeeId?: string; from?: string; to?: string }) {
    return apiGet<AbsenceRequest[]>(`${A}/requests?${qs(f)}`);
  }
  async assign(employeeId: string, input: RequestInput) {
    return (await apiWrite<AbsenceRequest>(`${A}/requests`, { body: { employeeId, ...input } })).data;
  }
  async cancel(id: string, reason: string | null) {
    return (await apiWrite<AbsenceRequest>(`${A}/requests/${id}/cancel`, { body: { reason } })).data;
  }
  balances(employeeId: string, date?: string) {
    return apiGet<Balance[]>(`${A}/balances?${qs({ employeeId, date })}`);
  }
  async adjust(input: { employeeId: string; typeId: string; period: string; amount: number; reason: string }) {
    await apiWrite(`${A}/balances/adjust`, { body: input });
  }
  async holidayCompensation(employeeId: string, from: string, to: string) {
    return (await apiWrite<{ granted: number; requested: number }>(`${A}/holiday-compensation`, { body: { employeeId, from, to } })).data;
  }
}

export class HttpMyAbsencesApiAdapter implements MyAbsencesApiPort {
  requests() {
    return apiGet<{ employeeId: string; requests: AbsenceRequest[] }>("/api/me/absences");
  }
  types() {
    return apiGet<AbsenceType[]>("/api/me/absences/types");
  }
  balances() {
    return apiGet<Balance[]>("/api/me/absences/balances");
  }
  async request(input: RequestInput) {
    return (await apiWrite<AbsenceRequest>("/api/me/absences", { body: input })).data;
  }
  async cancel(id: string) {
    return (await apiWrite<AbsenceRequest>(`/api/me/absences/${id}/cancel`, {})).data;
  }
  approvals() {
    return apiGet<AbsenceRequest[]>("/api/me/approvals");
  }
  async decide(id: string, decision: "approve" | "reject", comment: string | null) {
    return (await apiWrite<AbsenceRequest>(`/api/me/approvals/${id}/${decision}`, { body: { comment } })).data;
  }
}
