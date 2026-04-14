import type { EmployeeListParams, ListPaymentsParams, ShiftsParams } from "./hrApi";

export const hrQueryKeys = {
  root: ["hr"] as const,
  employees: (p: EmployeeListParams = {}) =>
    [...hrQueryKeys.root, "employees", p] as const,
  employee: (id: string) => [...hrQueryKeys.root, "employee", id] as const,
  shifts: (p: ShiftsParams) => [...hrQueryKeys.root, "shifts", p] as const,
  payments: (employeeId: string, filters?: ListPaymentsParams) =>
    [...hrQueryKeys.root, "payments", employeeId, filters ?? null] as const,
};
