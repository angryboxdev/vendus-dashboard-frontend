/** Novo RH → Escalas (Fase 7). Espelha `/api/novo-rh/rosters` e `/api/me/roster`. */

export interface Segment {
  start: string;
  end: string;
}

export interface ShiftTemplate {
  id: string;
  name: string;
  abbreviation: string;
  color: string | null;
  onCall: boolean;
  segments: Segment[];
  archived: boolean;
}

export interface Roster {
  id: string;
  name: string;
  targetType: "location" | "group";
  targetId: string;
  version: number;
  archived: boolean;
}

/** Visão macro de uma escala (`GET /rosters/summary`). */
export interface RosterSummary {
  roster: Roster;
  /** Quem tem turnos no período. */
  employeeIds: string[];
  shifts: number;
  /** Alterações por publicar no período. */
  pending: number;
  lastPublishedAt: string | null;
}

export interface ShiftState {
  employeeId: string;
  workDate: string;
  kind: "shift" | "day_off";
  segments: Segment[];
  templateId: string | null;
  onCall: boolean;
}

export interface RosterShift extends ShiftState {
  id: string;
  rosterId: string;
  deleted: boolean;
  dirty: boolean;
  published: ShiftState | null;
  publishedVersion: number | null;
}

export interface Violation {
  rule: "overlap" | "min_rest" | "max_daily" | "max_weekly" | "max_annual" | "absence";
  severity: "warning" | "block";
  employeeId: string;
  workDate: string;
  message: string;
}

export interface Publication {
  id: string;
  version: number;
  reason: string | null;
  confirmedWarnings: Violation[];
  changes: { shiftId: string; employeeId: string; before: ShiftState | null; after: ShiftState | null }[];
  publishedBy: string;
  createdAt: string;
}

export interface Swap {
  id: string;
  shiftId: string;
  counterShiftId: string | null;
  requesterEmployeeId: string;
  targetEmployeeId: string;
  status: "pending_target" | "pending_manager" | "approved" | "rejected" | "cancelled";
  comment: string | null;
  createdAt: string;
}

export interface ShiftInput {
  employeeId: string;
  workDate: string;
  kind: "shift" | "day_off";
  templateId: string | null;
  segments: Segment[];
}

/** Opções de publicação/alteração: motivo (turno publicado) e confirmação de avisos. */
export interface PublishOptions {
  reason: string | null;
  confirm: boolean;
}
