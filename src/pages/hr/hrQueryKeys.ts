import type { AuditLogsParams, EmployeeListParams, ListPaymentsParams, ShiftsParams } from "./hrApi";
import type { LeaveType } from "./hr.types";

export const hrQueryKeys = {
  root: ["hr"] as const,
  employees: (p: EmployeeListParams = {}) =>
    [...hrQueryKeys.root, "employees", p] as const,
  employee: (id: string) => [...hrQueryKeys.root, "employee", id] as const,
  shifts: (p: ShiftsParams) => [...hrQueryKeys.root, "shifts", p] as const,
  payments: (employeeId: string, filters?: ListPaymentsParams) =>
    [...hrQueryKeys.root, "payments", employeeId, filters ?? null] as const,
  auditLogs: (p: AuditLogsParams = {}) =>
    [...hrQueryKeys.root, "audit-logs", p] as const,
  publicHolidays: (year?: number) =>
    [...hrQueryKeys.root, "public-holidays", year ?? null] as const,
  leaveRequests: (employeeId: string, year?: number, type?: LeaveType) =>
    [...hrQueryKeys.root, "leave", employeeId, year ?? null, type ?? null] as const,
  leaveOverview: (year: number) =>
    [...hrQueryKeys.root, "leave-overview", year] as const,
  leaveBalance: (employeeId: string, year: number) =>
    [...hrQueryKeys.root, "leave-balance", employeeId, year] as const,
};
