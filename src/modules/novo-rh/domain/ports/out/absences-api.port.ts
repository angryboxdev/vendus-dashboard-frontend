import type { AbsenceRequest, AbsenceType, AbsenceTypeInput, ApprovalFlow, ApprovalFlowInput, Balance, RequestInput, RequestStatus } from "../../entities/absences.ts";

/** Gestão (`/api/novo-rh/absences`). */
export interface AbsencesApiPort {
  listTypes(): Promise<AbsenceType[]>;
  createType(input: AbsenceTypeInput): Promise<AbsenceType>;
  updateType(id: string, input: AbsenceTypeInput): Promise<AbsenceType>;
  archiveType(id: string): Promise<void>;
  listFlows(): Promise<ApprovalFlow[]>;
  createFlow(input: ApprovalFlowInput): Promise<ApprovalFlow>;
  archiveFlow(id: string): Promise<void>;
  listRequests(filter: { status?: RequestStatus; employeeId?: string; from?: string; to?: string }): Promise<AbsenceRequest[]>;
  assign(employeeId: string, input: RequestInput): Promise<AbsenceRequest>;
  cancel(id: string, reason: string | null): Promise<AbsenceRequest>;
  balances(employeeId: string, date?: string): Promise<Balance[]>;
  adjust(input: { employeeId: string; typeId: string; period: string; amount: number; reason: string }): Promise<void>;
  holidayCompensation(employeeId: string, from: string, to: string): Promise<{ granted: number; requested: number }>;
}

/** As minhas ausências e a caixa do aprovador (`/api/me/absences`, `/api/me/approvals`). */
export interface MyAbsencesApiPort {
  requests(): Promise<{ employeeId: string; requests: AbsenceRequest[] }>;
  types(): Promise<AbsenceType[]>;
  balances(): Promise<Balance[]>;
  request(input: RequestInput): Promise<AbsenceRequest>;
  cancel(id: string): Promise<AbsenceRequest>;
  approvals(): Promise<AbsenceRequest[]>;
  decide(id: string, decision: "approve" | "reject", comment: string | null): Promise<AbsenceRequest>;
}
