import type { JobRole } from "./employee.ts";

export type ShiftStatus = "draft" | "published";
export type ShiftSource = "manual" | "base_schedule" | "rotation";
export type ShiftAttendanceStatusValue = "worked_as_planned" | "late" | "left_early" | "cancelled";

export interface WorkShift {
  id: string;
  employeeId: string;
  employeeName: string;
  workDate: string;
  startTime: string;
  endTime: string;
  /** Turno noturno (atravessa a meia-noite) — `endTime` refere-se ao dia seguinte a `workDate`. */
  endsNextDay: boolean;
  /** 2º período de um turno repartido — null = turno direto (1 período). */
  secondStartTime: string | null;
  secondEndTime: string | null;
  locationId: string;
  breakMinutes: number;
  notes: string | null;
  status: ShiftStatus;
  source: ShiftSource;
  rotationId: string | null;
  /** Tag partilhada por todos os turnos criados na mesma série recorrente — null = avulso, ou já destacado por edição individual ("Somente este turno"). */
  seriesId: string | null;
  attendanceStatus: ShiftAttendanceStatusValue | null;
  createdAt: string;
  updatedAt: string;
}

export interface ListWorkShiftsParams {
  from: string;
  to: string;
  employeeId?: string;
  locationId?: string;
  status?: ShiftStatus;
}

export interface CreateWorkShiftPayload {
  employeeId: string;
  workDate: string;
  startTime: string;
  endTime: string;
  endsNextDay?: boolean;
  secondStartTime?: string | null;
  secondEndTime?: string | null;
  locationId: string;
  breakMinutes?: number;
  notes?: string | null;
  repeatWeeks?: number;
  publish?: boolean;
}

export type UpdateWorkShiftPayload = Partial<
  Pick<
    CreateWorkShiftPayload,
    "workDate" | "startTime" | "endTime" | "endsNextDay" | "secondStartTime" | "secondEndTime" | "locationId" | "breakMinutes" | "notes"
  >
>;

// ── "Novo turno" — padrão semanal / séries recorrentes ──────────────────────

export interface ShiftSegment {
  startTime: string;
  endTime: string;
}

export interface WeeklyDayRule {
  weekdays: Weekday[];
  /** 1 período = turno direto; 2 = turno repartido. */
  segments: ShiftSegment[];
  endsNextDay?: boolean;
}

export type RepeatMode = { kind: "none" } | { kind: "weeks"; weeks: number } | { kind: "until_date"; untilDate: string };

export type OccurrenceStatus = "available" | "conflict" | "skipped_leave" | "skipped_holiday";

export interface PlannedOccurrence {
  workDate: string;
  weekday: Weekday;
  segments: ShiftSegment[];
  endsNextDay: boolean;
  status: OccurrenceStatus;
}

export interface PreviewWorkShiftSeriesPayload {
  employeeId: string;
  locationId: string;
  startDate: string;
  rules: WeeklyDayRule[];
  repeat: RepeatMode;
}

export interface PreviewWorkShiftSeriesResult {
  occurrences: PlannedOccurrence[];
  availableCount: number;
  conflictCount: number;
  skippedCount: number;
}

export interface CreateWorkShiftSeriesPayload extends PreviewWorkShiftSeriesPayload {
  publish: boolean;
  force?: boolean;
  notes?: string | null;
}

export interface CreateWorkShiftSeriesResult {
  seriesId: string | null;
  created: WorkShift[];
  conflicts: PlannedOccurrence[];
  skipped: PlannedOccurrence[];
}

export type SeriesEditScope = "only_this" | "this_and_following" | "whole_series";

export interface UpdateWorkShiftSeriesScopePayload {
  scope: SeriesEditScope;
  startTime?: string;
  endTime?: string;
  endsNextDay?: boolean;
  secondStartTime?: string | null;
  secondEndTime?: string | null;
  locationId?: string;
  notes?: string | null;
}

export type ClearShiftsScope =
  | { kind: "day"; employeeId: string; workDate: string }
  | { kind: "days"; employeeId: string; workDates: string[] }
  | { kind: "week"; employeeId: string; weekStartDate: string }
  | { kind: "weeks"; employeeId: string; weekStartDates: string[] }
  | { kind: "series"; seriesId: string }
  /** Limpa a semana toda para TODOS os colaboradores — nunca implícito, só quando pedido sem filtro de colaborador. */
  | { kind: "week_all"; weekStartDate: string; locationId?: string };

export interface ClearWorkShiftsResult {
  deletedCount: number;
  skipped: Array<{ id: string; workDate: string; reason: "has_attendance" }>;
}

// ── Escala base ──────────────────────────────────────────────────────────────

/** 0 = Segunda .. 6 = Domingo */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "Seg",
  1: "Ter",
  2: "Qua",
  3: "Qui",
  4: "Sex",
  5: "Sáb",
  6: "Dom",
};

export interface BaseScheduleCell {
  id: string;
  employeeId: string;
  weekday: Weekday;
  isDayOff: boolean;
  startTime: string | null;
  endTime: string | null;
  locationId: string | null;
  breakMinutes: number;
}

export interface UpsertBaseScheduleCellPayload {
  weekday: Weekday;
  isDayOff: boolean;
  startTime?: string;
  endTime?: string;
  locationId?: string;
  breakMinutes?: number;
}

export interface ApplyBaseScheduleResult {
  created: WorkShift[];
  updated: WorkShift[];
  skippedDates: string[];
}

// ── Turnos rotativos ─────────────────────────────────────────────────────────

export interface ShiftRotationPattern {
  startTime: string;
  endTime: string;
  /** 2º período (turno repartido) — null = turno direto (1 período). */
  secondStartTime: string | null;
  secondEndTime: string | null;
}

export interface ShiftRotation {
  id: string;
  jobRole: JobRole;
  participantEmployeeIds: [string, string];
  participantNames: [string, string];
  patternA: ShiftRotationPattern;
  patternB: ShiftRotationPattern;
  locationId: string;
  anchorDate: string;
  autoSwitchWeekly: boolean;
  active: boolean;
}

export interface CreateShiftRotationPayload {
  jobRole: JobRole;
  participantEmployeeIds: [string, string];
  patternA: { startTime: string; endTime: string; secondStartTime?: string | null; secondEndTime?: string | null };
  patternB: { startTime: string; endTime: string; secondStartTime?: string | null; secondEndTime?: string | null };
  locationId: string;
  anchorDate: string;
  autoSwitchWeekly?: boolean;
}

export interface RotationWeekPreview {
  weekStartDate: string;
  patternAEmployeeId: string;
  patternAEmployeeName: string;
  patternBEmployeeId: string;
  patternBEmployeeName: string;
  patternA: ShiftRotationPattern;
  patternB: ShiftRotationPattern;
}

// ── "Repetir escala pelo calendário" ─────────────────────────────────────────
// Copia os turnos REAIS de uma semana já montada (vários colaboradores, cada
// um com o seu próprio padrão) para as semanas seguintes.

export interface RepeatWeekLocationGroup {
  locationId: string;
  availableCount: number;
  conflictCount: number;
  skippedCount: number;
  occurrences: PlannedOccurrence[];
}

export interface RepeatWeekEmployeeResult {
  employeeId: string;
  employeeName: string;
  availableCount: number;
  conflictCount: number;
  skippedCount: number;
  locations: RepeatWeekLocationGroup[];
}

export interface PreviewRepeatCalendarWeekPayload {
  sourceWeekStartDate: string;
  weekdays: Weekday[];
  /** Define também a ordem de rotação quando `rotateEmployees`. */
  employeeIds?: string[];
  /** Alterna o horário de cada colaborador com o do seguinte em `employeeIds` (2 = troca simples) em vez de cada um repetir o seu próprio. */
  rotateEmployees?: boolean;
  repeat: RepeatMode;
}

export interface PreviewRepeatCalendarWeekResult {
  targetStartDate: string;
  targetEndDate: string;
  employees: RepeatWeekEmployeeResult[];
  totalAvailable: number;
  totalConflicts: number;
  totalSkipped: number;
}

export interface RepeatCalendarWeekPayload extends PreviewRepeatCalendarWeekPayload {
  publish: boolean;
  force?: boolean;
  notes?: string | null;
}

export interface RepeatCalendarWeekEmployeeResult {
  employeeId: string;
  employeeName: string;
  created: WorkShift[];
  conflicts: PlannedOccurrence[];
  skipped: PlannedOccurrence[];
}

export interface RepeatCalendarWeekResult {
  employees: RepeatCalendarWeekEmployeeResult[];
  totalCreated: number;
  totalConflicts: number;
  totalSkipped: number;
}

// ── Alertas ──────────────────────────────────────────────────────────────────

export interface ScheduleAlerts {
  coverageGaps: Array<{ employeeId: string; employeeName: string; workDate: string; locationId: string | null }>;
  overlaps: Array<{ employeeId: string; employeeName: string; workDate: string; shiftIds: string[] }>;
  pendingPublishCount: number;
  pendingPublishRange: { from: string; to: string } | null;
}

// ── Estados/legenda do calendário (bolinha + legenda) ───────────────────────

export const SHIFT_ATTENDANCE_STATUS_LABELS: Record<ShiftAttendanceStatusValue, string> = {
  worked_as_planned: "Conferido",
  late: "Conferido (atraso)",
  left_early: "Conferido (saída antecipada)",
  cancelled: "Cancelado",
};

// ── Ausências/feriados (lidos diretamente da rota legacy — mesmo padrão de
// confirmShiftAttendance: nunca importa src/pages/hr/hrApi.ts) ─────────────

export type LeaveType = "vacation" | "sick_leave" | "justified" | "unjustified" | "compensatory";

export interface LeaveOverviewEntry {
  id: string;
  employeeId: string;
  type: LeaveType;
  startDate: string;
  endDate: string;
}

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  vacation: "Férias",
  sick_leave: "Baixa médica",
  justified: "Falta justificada",
  unjustified: "Falta injustificada",
  compensatory: "Folga compensatória",
};

export interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  isNational: boolean;
}
