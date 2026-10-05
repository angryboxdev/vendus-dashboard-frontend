import type { AttendanceIssueRow } from "./attendance-conference.ts";

/**
 * Ficha individual — "Assiduidade — Nome" (evolução "Assiduidade —
 * Conferência, Por Colaborador e Horas & Saldos", secção 18).
 * "Confirmadas"/"confirmado" excluem linhas ainda `reviewStatus:
 * "pending"` (ainda não passaram pelo gestor) — nunca turnos futuros
 * (secção 12, "planeado até agora").
 */
export interface AttendanceEmployeeDetailKpis {
  plannedShiftsCount: number;
  actualShiftsCount: number;
  pendingCount: number;
  lateDaysCount: number;
  lateMinutesTotal: number;
  absenceDaysCount: number;
  plannedMinutes: number;
  actualMinutesConfirmed: number;
  balanceConfirmed: number;
}

/**
 * Extrato diário completo (secção 19) — ao contrário da Conferência,
 * nunca pula os turnos "Regular"; reaproveita o mesmo `AttendanceIssueRow`
 * (mesmo `reviewStatus`, mesmo modal `Resolver`).
 */
export interface AttendanceEmployeeDetailResult {
  employeeId: string;
  employeeName: string;
  /** Redesign do Fecho Mensal — subtítulo do cabeçalho da ficha individual. */
  /** Cargo do colaborador (o nome resolve-se pela lista de cargos). */
  positionId: string | null;
  kpis: AttendanceEmployeeDetailKpis;
  rows: AttendanceIssueRow[];
}
