import {
  apiDeleteJson,
  apiDeleteNoContent,
  apiGet,
  apiPatch,
  apiPost,
} from "../../lib/api";
import type {
  HrEmployee,
  HrEmployeePayment,
  HrWorkShift,
  JobRole,
  RegistrationSource,
  ShiftAttendanceStatus,
  WeeklySchedule,
} from "./hr.types";
import type { AttendanceFormValues, PaymentFormValues } from "./hrSchemas";

const HR = "/api/hr";

export type EmployeeListParams = {
  status?: "active" | "inactive" | "all";
  limit?: number;
  offset?: number;
};

export function buildEmployeesQuery(params: EmployeeListParams): string {
  const q = new URLSearchParams();
  if (params.status != null) q.set("status", params.status);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchEmployees(
  params: EmployeeListParams = {},
): Promise<HrEmployee[]> {
  return apiGet(`${HR}/employees${buildEmployeesQuery(params)}`);
}

export async function fetchEmployee(id: string): Promise<HrEmployee> {
  return apiGet(`${HR}/employees/${encodeURIComponent(id)}`);
}

export type CreateEmployeeBody = {
  fullName: string;
  email?: string | null;
  phone?: string | null;
  roleOrNotes?: string | null;
  status?: HrEmployee["status"];
  /** Omitir no create → backend assume `service`. */
  jobRole?: JobRole;
  employmentType?: HrEmployee["employmentType"];
  hiredAt?: string | null;
  endedAt?: string | null;
  /** Omitir → `null` no servidor. */
  weeklySchedule?: WeeklySchedule | null;
};

export async function createEmployee(
  body: CreateEmployeeBody,
): Promise<HrEmployee> {
  return apiPost(`${HR}/employees`, body);
}

export type PatchEmployeeBody = Partial<CreateEmployeeBody>;

export async function patchEmployee(
  id: string,
  body: PatchEmployeeBody,
): Promise<HrEmployee> {
  return apiPatch(`${HR}/employees/${encodeURIComponent(id)}`, body);
}

export async function softDeleteEmployee(id: string): Promise<HrEmployee> {
  return apiDeleteJson(`${HR}/employees/${encodeURIComponent(id)}`);
}

export type ShiftsParams = {
  from: string;
  to: string;
  employeeId?: string;
};

export function buildShiftsQuery(p: ShiftsParams): string {
  const q = new URLSearchParams();
  q.set("from", p.from);
  q.set("to", p.to);
  if (p.employeeId) q.set("employeeId", p.employeeId);
  return `?${q.toString()}`;
}

export async function fetchShifts(p: ShiftsParams): Promise<HrWorkShift[]> {
  return apiGet(`${HR}/shifts${buildShiftsQuery(p)}`);
}

export type CreateShiftBody = {
  employeeId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  locationOrStation?: string | null;
  notes?: string | null;
};

export async function createShift(body: CreateShiftBody): Promise<HrWorkShift> {
  return apiPost(`${HR}/shifts`, body);
}

export type PatchShiftBody = Partial<CreateShiftBody>;

export async function patchShift(
  id: string,
  body: PatchShiftBody,
): Promise<HrWorkShift> {
  return apiPatch(`${HR}/shifts/${encodeURIComponent(id)}`, body);
}

export async function deleteShift(id: string): Promise<void> {
  return apiDeleteNoContent(`${HR}/shifts/${encodeURIComponent(id)}`);
}

/** Substituição completa dos campos de conferência (presença real vs planeado). */
export type PatchShiftAttendanceBody = {
  status: ShiftAttendanceStatus;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  lateMinutes?: number | null;
  absenceReason?: string | null;
  notes?: string | null;
  registrationSource?: RegistrationSource;
  registeredByEmployeeId?: string | null;
};

export async function patchShiftAttendance(
  shiftId: string,
  body: PatchShiftAttendanceBody,
): Promise<HrWorkShift> {
  return apiPatch(
    `${HR}/shifts/${encodeURIComponent(shiftId)}/attendance`,
    body,
  );
}

export function attendanceFormValuesToPatchBody(
  v: AttendanceFormValues,
): PatchShiftAttendanceBody {
  const lateTrim = v.lateMinutes.trim();
  let lateMinutes: number | null = null;
  if (v.status === "late" && lateTrim !== "") {
    const n = Number(lateTrim);
    if (Number.isFinite(n) && n >= 0) lateMinutes = Math.floor(n);
  }

  const absentLike =
    v.status === "absent_justified" ||
    v.status === "absent_unjustified" ||
    v.status === "cancelled";

  return {
    status: v.status,
    actualStartTime: absentLike
      ? null
      : v.actualStartTime.trim() || null,
    actualEndTime: absentLike ? null : v.actualEndTime.trim() || null,
    lateMinutes,
    absenceReason: v.absenceReason.trim() || null,
    notes: v.notes.trim() || null,
    registrationSource: "dashboard",
    registeredByEmployeeId: null,
  };
}

export type ListPaymentsParams =
  | { year: number; month: number }
  | { from: string; to: string }
  | undefined;

function buildPaymentsQuery(filters: ListPaymentsParams): string {
  if (!filters) return "";
  const q = new URLSearchParams();
  if ("year" in filters) {
    q.set("year", String(filters.year));
    q.set("month", String(filters.month));
  } else {
    q.set("from", filters.from);
    q.set("to", filters.to);
  }
  return `?${q.toString()}`;
}

export async function fetchEmployeePayments(
  employeeId: string,
  filters?: ListPaymentsParams,
): Promise<HrEmployeePayment[]> {
  const qs = buildPaymentsQuery(filters);
  return apiGet(
    `${HR}/employees/${encodeURIComponent(employeeId)}/payments${qs}`,
  );
}

export type CreatePaymentBody = {
  paymentDate: string;
  amount: number;
  paymentType: HrEmployeePayment["paymentType"];
  notes?: string | null;
  /** Incluir quando `paymentType` é `salary`. */
  salaryPeriodYear?: number;
  salaryPeriodMonth?: number;
};

export function paymentFormValuesToApiBody(
  v: PaymentFormValues,
): CreatePaymentBody {
  const body: CreatePaymentBody = {
    paymentDate: v.paymentDate,
    amount: v.amount,
    paymentType: v.paymentType,
    notes: v.notes?.trim() || null,
  };
  if (v.paymentType === "salary") {
    const m = /^(\d{4})-(\d{2})$/.exec(v.salaryPeriod.trim());
    if (m) {
      body.salaryPeriodYear = Number(m[1]);
      body.salaryPeriodMonth = Number(m[2]);
    }
  }
  return body;
}

export async function createEmployeePayment(
  employeeId: string,
  body: CreatePaymentBody,
): Promise<HrEmployeePayment> {
  return apiPost(
    `${HR}/employees/${encodeURIComponent(employeeId)}/payments`,
    body,
  );
}

export type PatchPaymentBody = Partial<CreatePaymentBody>;

export async function patchPayment(
  paymentId: string,
  body: PatchPaymentBody,
): Promise<HrEmployeePayment> {
  return apiPatch(
    `${HR}/payments/${encodeURIComponent(paymentId)}`,
    body,
  );
}

export async function deletePayment(paymentId: string): Promise<void> {
  return apiDeleteNoContent(
    `${HR}/payments/${encodeURIComponent(paymentId)}`,
  );
}
