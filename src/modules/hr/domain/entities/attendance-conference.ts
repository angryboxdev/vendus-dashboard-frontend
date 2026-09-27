export type AttendanceState = "REGULAR" | "PRESENTE" | "CONCLUIDO" | "PARCIAL" | "AUSENTE" | "EM_ABERTO" | "CONFLITO";

export interface AttendancePeriod {
  plannedStart: string | null;
  plannedEnd: string | null;
  actualStart: string | null;
  actualEnd: string | null;
}

export interface AttendanceIssueRow {
  shiftId: string | null;
  attendanceId: string | null;
  employeeId: string;
  employeeName: string;
  workDate: string;
  locationId: string | null;
  locationName: string | null;
  endsNextDay: boolean;
  periods: AttendancePeriod[];
  state: AttendanceState;
  occurrenceLabel: string;
  plannedMinutes: number;
  actualMinutes: number;
}

export interface AttendanceIssuesKpis {
  pendingCount: number;
  lateCount: number;
  actualMinutesTotal: number;
  plannedMinutesTotal: number;
  balanceMinutes: number;
}

export interface ListAttendanceIssuesResult {
  items: AttendanceIssueRow[];
  kpis: AttendanceIssuesKpis;
}

export type AttendanceCorrectionType = "add_entry" | "add_exit" | "fix_entry" | "fix_exit" | "mark_absence" | "confirm" | "observation";

export interface AttendanceCorrectionHistoryEntry {
  id: string;
  createdAt: string;
  correctionType: AttendanceCorrectionType;
  original: { status: string | null; actualStartTime: string | null; actualEndTime: string | null } | null;
  corrected: { status: string | null; actualStartTime: string | null; actualEndTime: string | null } | null;
  reason: string;
  notes: string | null;
  actor: string;
}

export interface AttendanceIssueDetail extends AttendanceIssueRow {
  diffMinutes: number;
  corrections: AttendanceCorrectionHistoryEntry[];
}

export interface CorrectShiftAttendancePayload {
  workShiftId: string | null;
  attendanceId: string | null;
  employeeId: string;
  workDate: string;
  locationId: string;
  correctionType: AttendanceCorrectionType;
  actualStartTime?: string | null;
  actualEndTime?: string | null;
  lateMinutes?: number | null;
  reason: string;
  notes?: string | null;
}

export interface MonthlyClosureStatus {
  year: number;
  month: number;
  status: "open" | "closed";
  closedBy: string | null;
  closedAt: string | null;
  reopenedBy: string | null;
  reopenedAt: string | null;
  reopenReason: string | null;
  blockerCount: number;
  plannedShiftsCount: number;
  regularShiftsCount: number;
  lateCount: number;
  leaveDaysCount: number;
}
