import type {
  Adjustment,
  BreakType,
  BreakTypeInput,
  AttendanceDays,
  ChangeInput,
  ClockEvent,
  ClockRevision,
  CorrectionRequest,
  Incident,
  IncidentStatus,
  MyClockStatus,
  QueuedPunch,
  SegmentType,
} from "../../entities/attendance.ts";

/** O meu ponto (`/api/me/clock`). */
export interface MyClockApiPort {
  status(): Promise<MyClockStatus>;
  /** `occurredAt`: hora do dispositivo, para marcações feitas sem rede. */
  punch(input: { segmentType: SegmentType; clientEventId: string; occurredAt?: string; breakTypeId?: string | null }): Promise<{ event: ClockEvent; duplicate: boolean }>;
  /** Pausas que se podem escolher (FE-103). */
  breakTypes(): Promise<BreakType[]>;
  days(from: string, to: string): Promise<AttendanceDays>;
  refuse(revisionId: string, comment: string | null): Promise<ClockRevision>;
  corrections(): Promise<CorrectionRequest[]>;
  requestCorrection(input: ChangeInput): Promise<CorrectionRequest>;
}

/** Gestão da assiduidade (`/api/novo-rh/attendance`). */
export interface AttendanceApiPort {
  days(employeeId: string, from: string, to: string): Promise<AttendanceDays>;
  revise(employeeId: string, input: ChangeInput): Promise<ClockRevision>;
  corrections(status?: CorrectionRequest["status"]): Promise<CorrectionRequest[]>;
  decide(id: string, decision: "approve" | "reject", comment: string | null): Promise<CorrectionRequest>;
  incidents(filter: { from: string; to: string; status?: IncidentStatus; employeeId?: string }): Promise<Incident[]>;
  resolveIncident(id: string, resolution: "correct" | "validate" | "dismiss", comment: string | null): Promise<Incident>;
  adjustments(employeeId: string, from: string, to: string): Promise<Adjustment[]>;
  recalculate(employeeId: string, from: string, to: string): Promise<{ queued: number }>;
  listBreakTypes(): Promise<BreakType[]>;
  createBreakType(input: BreakTypeInput): Promise<BreakType>;
  updateBreakType(id: string, input: BreakTypeInput, version: number, reason: string): Promise<BreakType>;
  archiveBreakType(id: string): Promise<void>;
}

/** Onde a fila offline fica guardada (no navegador). */
export interface PunchQueueStoragePort {
  load(): QueuedPunch[];
  save(items: QueuedPunch[]): void;
}
