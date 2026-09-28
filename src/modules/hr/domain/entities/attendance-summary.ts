/**
 * Evolução "Assiduidade — Conferência, Por Colaborador e Horas & Saldos":
 * `status` não tem fórmula definida na task (secção 17 só nomeia os 3
 * estados) — regra própria do backend, documentada no seu README
 * (`deriveEmployeeStatus`).
 */
export type AttendanceEmployeeStatus = "pronto_para_fecho" | "pendencias" | "requer_atencao";

/** "Por colaborador" (antes "Resumo mensal"): 1 linha por colaborador com o agregado do mês. */
export interface MonthlyAttendanceSummaryRow {
  employeeId: string;
  employeeName: string;
  /** Turnos planeados no mês. */
  plannedShiftsCount: number;
  actualShiftsCount: number;
  pendingCount: number;
  plannedMinutes: number;
  actualMinutes: number;
  lateDaysCount: number;
  lateMinutesTotal: number;
  absenceDaysCount: number;
  /** `actualMinutes - planeado ATÉ HOJE` (nunca o total do mês — turnos futuros nunca reduzem saldo). */
  balanceMinutes: number;
  status: AttendanceEmployeeStatus;
}

export interface MonthlyAttendanceSummaryKpis {
  employeeCount: number;
  plannedShiftsCount: number;
  actualShiftsCount: number;
  lateDaysCount: number;
  lateMinutesTotal: number;
}

export interface MonthlyAttendanceSummaryResult {
  kpis: MonthlyAttendanceSummaryKpis;
  rows: MonthlyAttendanceSummaryRow[];
}
