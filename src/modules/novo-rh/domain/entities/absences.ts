/** Novo RH → Ausências (Fase 5). Espelha `/api/novo-rh/absences`, `/api/me/absences` e `/api/me/approvals`. */

export type AbsenceCategory = "vacation" | "permission" | "medical" | "compensation";
export type TimeImpact = "reduce_theoretical" | "count_as_worked" | "none";
export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface AbsenceType {
  id: string;
  name: string;
  code: string | null;
  color: string | null;
  category: AbsenceCategory;
  unit: "days" | "hours";
  counting: "working" | "calendar";
  limitAmount: number | null;
  renewal: "calendar_year" | "work_year";
  allowNegative: boolean;
  carryOver: boolean;
  requiresApproval: boolean;
  private: boolean;
  hiddenFromEmployee: boolean;
  attachment: "none" | "optional" | "required";
  timeImpact: TimeImpact;
  intersectSchedule: boolean;
  halfDay: boolean;
  minConsecutive: number | null;
  maxConsecutive: number | null;
  blockedDates: string[];
  paid: boolean;
  flowId: string | null;
  archived: boolean;
}

export type AbsenceTypeInput = Omit<AbsenceType, "id" | "archived">;

export interface FlowLevel {
  people: string[];
  roles: string[];
}

export interface ApprovalFlow {
  id: string;
  name: string;
  scope: "absences" | "clock";
  isDefault: boolean;
  levels: FlowLevel[];
  fallbackUserIds: string[];
  archived: boolean;
}

export type ApprovalFlowInput = Omit<ApprovalFlow, "id" | "archived">;

export interface AbsenceRequest {
  id: string;
  employeeId: string;
  typeId: string;
  typeName: string;
  typeColor: string | null;
  private: boolean;
  kind: "absence" | "holiday_compensation";
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  halfDay: boolean;
  amount: number;
  unit: "days" | "hours";
  period: string;
  status: RequestStatus;
  comment: string | null;
  requestedBy: string;
  levels: { approvers: string[]; escalated: boolean }[];
  currentLevel: number;
  cancelReason: string | null;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  kind: "accrual" | "request" | "reversal" | "adjustment" | "expiry" | "carryover" | "holiday_compensation";
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
  referenceDate: string | null;
}

export interface Balance {
  typeId: string;
  typeName: string;
  unit: "days" | "hours";
  limited: boolean;
  period: string;
  accrued: number;
  used: number;
  adjusted: number;
  balance: number;
  pending: number;
  available: number;
  entries: LedgerEntry[];
}

export interface RequestInput {
  typeId: string;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  halfDay: boolean;
  comment: string | null;
}
