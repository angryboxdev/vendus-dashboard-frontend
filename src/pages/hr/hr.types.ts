export type HrEmployeeStatus = "active" | "inactive";

export type JobRole = "manager" | "prep" | "service";

export const JOB_ROLE_LABELS: Record<JobRole, string> = {
  manager: "Gerente",
  prep: "Preparador",
  service: "Serviço",
};

export function normalizeJobRole(v: unknown): JobRole {
  if (v === "manager" || v === "prep" || v === "service") return v;
  return "service";
}

/** Alinhado com o contrato API: `employmentType` em camelCase no JSON. */
export type HrEmploymentType = "permanent" | "contract" | "extra";

export const HR_EMPLOYMENT_TYPE_LABELS: Record<HrEmploymentType, string> = {
  permanent: "Efetivo",
  contract: "Contrato (a termo)",
  extra: "Extra",
};

export function normalizeEmploymentType(v: unknown): HrEmploymentType {
  if (v === "permanent" || v === "contract" || v === "extra") return v;
  return "permanent";
}

/** Segunda = 0 … domingo = 6 (alinhado à API HR). */
export type WeeklyScheduleDay = {
  weekday: number;
  segments: { startTime: string; endTime: string }[];
};

export type WeeklySchedule = {
  days: WeeklyScheduleDay[];
};

export type HrEmployee = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  roleOrNotes: string | null;
  status: HrEmployeeStatus;
  /** Função na pizzaria (`manager` | `prep` | `service`). Respostas antigas sem campo → usar `normalizeJobRole`. */
  jobRole?: JobRole | null;
  /** Efetivo / contrato a termo / extra — requer coluna + API no backend. */
  employmentType?: HrEmploymentType | null;
  /** Escala semanal base (JSON); `null` se nunca definida ou apagada. */
  weeklySchedule?: WeeklySchedule | null;
  hiredAt: string | null;
  endedAt: string | null;
  /** True se o funcionário tem um PIN de kiosk configurado. */
  hasKioskPin?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ShiftAttendanceStatus =
  | "worked_as_planned"
  | "late"
  | "left_early"
  | "absent_justified"
  | "absent_unjustified"
  | "cancelled";

export const SHIFT_ATTENDANCE_STATUS_LABELS: Record<
  ShiftAttendanceStatus,
  string
> = {
  worked_as_planned: "Cumpriu o planeado",
  late: "Atraso",
  left_early: "Saída antecipada",
  absent_justified: "Falta justificada",
  absent_unjustified: "Falta não justificada",
  cancelled: "Cancelado",
};

export type RegistrationSource = "dashboard" | "employee_qr" | "import";

export type HrShiftAttendance = {
  id: string;
  workShiftId: string;
  status: ShiftAttendanceStatus;
  actualStartTime: string | null;
  actualEndTime: string | null;
  lateMinutes: number | null;
  absenceReason: string | null;
  notes: string | null;
  registrationSource: RegistrationSource;
  registeredByEmployeeId: string | null;
  registeredAt: string;
  updatedAt: string;
};

export type HrWorkShift = {
  id: string;
  employeeId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  locationOrStation: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  /** `null` = conferência ainda não registada na API. */
  attendance?: HrShiftAttendance | null;
};

/** Conferência pendente quando não há registo de presença. */
export function isShiftAttendancePending(s: HrWorkShift): boolean {
  return s.attendance == null;
}

export type HrPaymentType = "salary" | "bonus" | "deduction" | "other";

export type HrEmployeePayment = {
  id: string;
  employeeId: string;
  paymentDate: string;
  amount: number;
  paymentType: HrPaymentType;
  /** Calendário civil a que o salário se refere (só para `paymentType === "salary"`). Requer backend. */
  salaryPeriodYear?: number | null;
  salaryPeriodMonth?: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Valor `YYYY-MM` para o date picker de mês (só salário). */
export function salaryPeriodValueFromPayment(
  p: HrEmployeePayment,
): string {
  if (p.paymentType !== "salary") return "";
  if (p.salaryPeriodYear != null && p.salaryPeriodMonth != null) {
    return `${p.salaryPeriodYear}-${String(p.salaryPeriodMonth).padStart(2, "0")}`;
  }
  return "";
}

export function formatSalaryPeriodLabel(
  p: HrEmployeePayment,
): string {
  if (p.paymentType !== "salary") return "—";
  if (p.salaryPeriodYear != null && p.salaryPeriodMonth != null) {
    return new Intl.DateTimeFormat("pt-PT", {
      month: "long",
      year: "numeric",
    }).format(new Date(p.salaryPeriodYear, p.salaryPeriodMonth - 1, 1));
  }
  return "—";
}
