export type AttendanceState = "REGULAR" | "PRESENTE" | "CONCLUIDO" | "PARCIAL" | "AUSENTE" | "EM_ABERTO" | "CONFLITO";

/**
 * Classificação da ocorrência segundo as regras de tolerância (Fase 2.1) —
 * calculada e devolvida pelo backend, nunca derivada no frontend (task,
 * secção 16). Sempre presente (o backend classifica mesmo sem nenhuma
 * regra configurada, usando defaults — nunca bloqueia à espera de
 * configuração).
 */
export type AttendanceOccurrenceKind =
  | "late_entry"
  | "early_exit"
  | "no_entry"
  | "no_exit"
  | "absence"
  | "unscheduled_presence"
  | "conflict"
  | "before_window"
  /** Turno repartido com 1 período cumprido e o outro com marcação em falta (evolução "Por Colaborador"). */
  | "incomplete_period"
  | "ok";

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
  /** Fase 2.1 — ver `AttendanceOccurrenceKind`. */
  occurrenceKind: AttendanceOccurrenceKind;
  /** Fase 2.1 — diferença real (minutos) entre planeado e registado, com sinal; `null` quando não aplicável (ex.: sem entrada). */
  diffMinutes: number | null;
  /** Fase 2.1 — estado do fluxo de conferência (distinto de `state`, que é a classificação de presença). */
  reviewStatus: "pending" | "conferred";
}

/**
 * Evolução "Assiduidade — Conferência, Por Colaborador e Horas & Saldos"
 * (secção 3): a Conferência é uma fila de trabalho por fazer — todos os
 * KPIs contam só `reviewStatus: "pending"`. Horas planeadas/realizadas/
 * Saldo saíram daqui (secção 3, explícito) — vivem em "Por colaborador"
 * (`MonthlyAttendanceSummaryResult`).
 */
export interface AttendanceIssuesKpis {
  pendingCount: number;
  /** Dias de trabalho (colaborador+data), só pendentes, com ≥1 atraso acima da tolerância. */
  lateDaysCount: number;
  /** Soma do atraso real (minutos) de todas as entradas pendentes fora da tolerância. */
  lateMinutesTotal: number;
  /** Nº de ocorrências de atraso pendentes (não confundir com `lateDaysCount`). */
  lateOccurrencesCount: number;
  /** "Possíveis ausências" — pendentes com `occurrenceKind: "absence"`. */
  possibleAbsencesCount: number;
  /** "Sem saída" — pendentes com `occurrenceKind: "no_exit"`. */
  noExitCount: number;
  /** "Conflitos" — pendentes com `occurrenceKind: "conflict"`. */
  conflictsCount: number;
}

export interface ListAttendanceIssuesResult {
  items: AttendanceIssueRow[];
  kpis: AttendanceIssuesKpis;
}

/**
 * Fase 2.1 — substitui o conjunto anterior (mais granular: add_entry/
 * add_exit/fix_entry/fix_exit/confirm/observation) pelas 5 ações do
 * mockup de resolução de ocorrência. `fix_times` cobre entrada e saída
 * num único fluxo (os campos `actualStartTime`/`actualEndTime` do payload
 * são ambos opcionais, preenche-se só o que se corrige).
 */
export type AttendanceCorrectionType = "keep_as_is" | "fix_times" | "justify_no_impact" | "mark_absence" | "remove_marking";

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
