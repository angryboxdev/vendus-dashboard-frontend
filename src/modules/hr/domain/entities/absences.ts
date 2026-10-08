/** Férias & Ausências 2.0 — contrato com `/api/hr/leave/board` e `/api/hr/leave/absences` (backend, módulo hr). */

export type AbsenceType = "vacation" | "sick_leave" | "justified" | "unjustified" | "compensatory" | "authorized_absence" | "license" | "other";
export type AbsenceDuration = "day" | "half_day" | "hours";
export type AbsenceRecordStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface AbsenceRecord {
  id: string;
  /** "absence" = registo; "request" = pedido do Portal ainda não aprovado. */
  source: "absence" | "request";
  employeeId: string;
  employeeName: string;
  positionName: string | null;
  locationId: string | null;
  locationName: string | null;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  duration: string;
  status: AbsenceRecordStatus;
  affectedShifts: number;
  notes: string | null;
  origin: "hr" | "portal";
  decisionNote: string | null;
}

export interface AbsenceBoard {
  records: AbsenceRecord[];
  /** Feriados no intervalo. */
  holidays: Array<{ date: string; name: string }>;
  attention: { pendingRequests: number; pendingDocuments: number; shiftConflicts: number };
}

export interface RegisterAbsencePayload {
  employeeId: string;
  type: AbsenceType;
  duration: AbsenceDuration;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string | null;
}

export interface AbsenceImpact {
  workingDays: number;
  duration: string;
  balance: { defined: boolean; available: number | null; after: number | null } | null;
  affectedShifts: Array<{ workDate: string; hours: string }>;
  othersAbsent: string[];
  overlapsExisting: boolean;
}

export const ABSENCE_TYPE_LABEL: Record<AbsenceType, string> = {
  vacation: "Férias",
  sick_leave: "Baixa médica",
  justified: "Falta justificada",
  unjustified: "Falta injustificada",
  compensatory: "Folga compensatória",
  authorized_absence: "Ausência autorizada",
  license: "Licença",
  other: "Outra ausência",
};

/** Cores (fundo + texto + ponto) por tipo, como no mockup. */
export const ABSENCE_TYPE_STYLE: Record<AbsenceType, { chip: string; dot: string }> = {
  vacation: { chip: "bg-stone-100 text-stone-700", dot: "bg-orange-500" },
  sick_leave: { chip: "bg-stone-100 text-stone-700", dot: "bg-violet-500" },
  justified: { chip: "bg-stone-100 text-stone-700", dot: "bg-indigo-500" },
  unjustified: { chip: "bg-stone-100 text-stone-700", dot: "bg-red-500" },
  compensatory: { chip: "bg-stone-100 text-stone-700", dot: "bg-amber-500" },
  authorized_absence: { chip: "bg-stone-100 text-stone-700", dot: "bg-sky-500" },
  license: { chip: "bg-stone-100 text-stone-700", dot: "bg-teal-500" },
  other: { chip: "bg-stone-100 text-stone-700", dot: "bg-stone-500" },
};

export const ABSENCE_STATUS_STYLE: Record<AbsenceRecordStatus, { label: string; cls: string }> = {
  pending: { label: "Pendente", cls: "bg-amber-100 text-amber-800" },
  approved: { label: "Aprovado", cls: "bg-emerald-100 text-emerald-800" },
  rejected: { label: "Rejeitado", cls: "bg-red-100 text-red-800" },
  cancelled: { label: "Cancelado", cls: "bg-stone-200 text-stone-700" },
};

/** Separador "Saldos". */
export interface LeaveBalanceRow {
  employeeId: string;
  employeeName: string;
  positionName: string | null;
  /** false = ainda não definido (valores sugeridos). */
  defined: boolean;
  daysEntitled: number;
  daysCarriedOver: number;
  suggested: number;
  taken: number;
  scheduled: number;
  available: number;
}

// ── Assiduidade → "Confirmar ausência" ───────────────────────────────────

export interface OccurrenceRef {
  workShiftId: string | null;
  attendanceId: string | null;
  employeeId: string;
  workDate: string;
  locationId: string;
}

export interface AbsenceCandidate {
  id: string;
  type: AbsenceType;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  duration: string;
}

export interface ConfirmAbsencePreview {
  match: "single" | "multiple" | "pending_request" | "none";
  candidates: AbsenceCandidate[];
  pendingRequest: { id: string; kind: "justify_absence" | "day_off"; startDate: string; endDate: string; reasonLabel: string; reasonText: string | null } | null;
  shiftStart: string | null;
  shiftEnd: string | null;
  endsNextDay: boolean;
}

export interface ConfirmAbsencePayload extends OccurrenceRef {
  absenceId?: string;
  newAbsence?: { type: AbsenceType; startTime?: string | null; endTime?: string | null; notes?: string | null };
}

export interface ConfirmAbsenceResult {
  outcome: "linked" | "created";
  fullDay: boolean;
  absence: AbsenceCandidate;
}
