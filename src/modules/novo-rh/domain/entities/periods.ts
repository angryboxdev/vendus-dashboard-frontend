/** Novo RH → Fecho de período (Fase 8). Espelha `/api/novo-rh/periods`. */

export interface PayPeriod {
  id: string;
  scopeType: "organization" | "location";
  scopeId: string | null;
  startDate: string;
  endDate: string;
  status: "open" | "closed" | "reopened";
}

export interface PendingItem {
  type: "incident" | "absence_request" | "correction_request" | "excess_validation";
  id: string;
  employeeId: string;
  date: string;
  label: string;
}

export interface Closure {
  id: string;
  closureNo: number;
  closedBy: string;
  exceptionReason: string | null;
  exceptions: PendingItem[];
  totals: { employeeId: string; workedSeconds: number }[];
  diff: { employeeId: string; field: string; before: number; after: number }[] | null;
  createdAt: string;
}

export interface Reopening {
  id: string;
  periodId: string;
  requestedBy: string;
  requestedByUserId: string;
  reason: string;
  approvals: { userId: string; by: string; at: string }[];
  status: "pending" | "approved" | "rejected";
}

export interface ExportJob {
  id: string;
  periodId: string;
  kind: "payroll" | "billing_location";
  status: "queued" | "running" | "done" | "failed";
  error: string | null;
  fileName: string | null;
  includeSensitive: boolean;
  expiresAt: string | null;
  createdAt: string;
}
