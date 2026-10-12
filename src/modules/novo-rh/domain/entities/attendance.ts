/** Novo RH → Assiduidade (Fase 4). Espelha `/api/me/clock` e `/api/novo-rh/attendance`. */

export type SegmentType = "work" | "remote" | "break_paid" | "break_unpaid" | "off";
export type IncidentType = "missing_in" | "missing_out" | "auto_closed" | "late";
export type IncidentStatus = "open" | "resolved_correct" | "resolved_validate" | "dismissed";
export type RevisionOperation = "add" | "update" | "void";

export interface Segment {
  start: string;
  end: string;
  type: Exclude<SegmentType, "off">;
  open: boolean;
  autoClosed: boolean;
}

export interface AttendanceDay {
  workDate: string;
  workedSeconds: number;
  breakSeconds: number;
  nightSeconds: number;
  theoreticalSeconds: number;
  excessSeconds: number;
  pendingSeconds: number;
  segments: Segment[];
  incidents: IncidentType[];
  version?: number | null;
}

export interface ClockEvent {
  id: string;
  employeeId: string;
  occurredAt: string;
  segmentType: SegmentType;
  source: string;
  locationId: string | null;
}

export interface ClockRevision {
  id: string;
  employeeId: string;
  operation: RevisionOperation;
  targetEventId: string | null;
  occurredAt: string | null;
  segmentType: SegmentType | null;
  reason: string;
  author: string;
  state: "active" | "refused";
  refusableUntil: string | null;
  anchorAt: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  employeeId: string;
  workDate: string;
  type: IncidentType;
  source: string;
  status: IncidentStatus;
  comment: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  requestedBy: string;
  operation: RevisionOperation;
  targetEventId: string | null;
  occurredAt: string | null;
  segmentType: SegmentType | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: string | null;
  decisionComment: string | null;
  createdAt: string;
}

export interface Adjustment {
  id: string;
  employeeId: string;
  workDate: string;
  fromVersion: number;
  toVersion: number;
  deltaExcessSeconds: number;
  reason: string;
  createdAt: string;
}

export interface AttendanceDays {
  employeeId: string;
  timeZone: string;
  days: AttendanceDay[];
  totals: { workedSeconds: number; theoreticalSeconds: number; excessSeconds: number; pendingSeconds: number; nightSeconds: number };
  events: ClockEvent[];
  revisions: ClockRevision[];
  incidents: Incident[];
  refusable: ClockRevision[];
}

export interface MyClockStatus {
  employeeId: string;
  timeZone: string;
  state: SegmentType;
  since: string | null;
  today: AttendanceDay;
  refusable: ClockRevision[];
}

export interface ChangeInput {
  operation: RevisionOperation;
  targetEventId: string | null;
  occurredAt: string | null;
  segmentType: SegmentType | null;
  reason: string;
}

/** Marcação à espera de envio (fila offline, RE-9). */
export interface QueuedPunch {
  clientEventId: string;
  segmentType: SegmentType;
  createdAt: string;
}
