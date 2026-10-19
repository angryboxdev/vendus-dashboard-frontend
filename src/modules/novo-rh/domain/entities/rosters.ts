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

/** O outro turno de uma sobreposição (onde está, a que horas, se já foi publicado). */
export interface ConflictRef {
  shiftId: string | null;
  rosterId: string | null;
  rosterName: string | null;
  workDate: string;
  hours: string;
  published: boolean;
}

export interface Violation {
  rule: "overlap" | "min_rest" | "max_daily" | "max_weekly" | "max_annual" | "absence";
  severity: "warning" | "block";
  employeeId: string;
  workDate: string;
  message: string;
  /** Turno afetado (ausente num turno ainda por criar). */
  shiftId?: string | null;
  rosterId?: string | null;
  /** Só sobreposição: o turno incompatível e o troço sobreposto ("14:00–17:00"). */
  conflict?: ConflictRef;
  overlap?: string;
}

/** Seletor «Adicionar colaboradores» (`GET /rosters/:id/candidates`). */
export interface RosterCandidates {
  roster: { id: string; targetType: "location" | "group"; targetId: string };
  /** Pertencem ao centro/grupo da escala (principal ou pertença datada). */
  members: string[];
  /** Turnos noutras escalas no período (rascunho ou publicado). */
  busy: { employeeId: string; rosterId: string; rosterName: string | null; shiftId: string; workDate: string; hours: string; published: boolean }[];
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
  /** Só publicar: o período (ex.: a semana visível); omisso = tudo o que está pendente. */
  from?: string;
  to?: string;
}
