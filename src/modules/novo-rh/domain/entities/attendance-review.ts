/**
 * Conferência de assiduidade V2 (pré-visualização): o dia de um colaborador
 * visto pelo gestor — o planeado publicado, as picagens originais e a decisão
 * de conferência. Os quatro conceitos nunca se misturam: a picagem é evidência
 * (imutável), o planeado vem da escala publicada, a decisão diz quem confirmou
 * o quê, e o tempo validado resulta da regra aplicada.
 */

/** Faixa de horário "HH:MM"–"HH:MM" (fim ≤ início = passa a meia-noite). */
export interface TimeRange {
  start: string;
  end: string;
}

export type PunchKind = "in" | "out" | "break_start" | "break_end";

/** Picagem original (evidência técnica; nunca é reescrita). */
export interface Punch {
  at: string;
  kind: PunchKind;
  /** Picagem do dia seguinte que pertence a este turno (noturno). */
  nextDay?: boolean;
}

/** As quatro decisões possíveis — mutuamente exclusivas. */
export type ReviewDecision = "fulfilled" | "keep" | "manual" | "absence";

export interface DayReview {
  /** Id da decisão gravada (para anular). */
  id?: string;
  createdAt?: string;
  decision: ReviewDecision;
  /** Minutos validados pela decisão (manter = os registados). */
  validatedMinutes: number;
  reason: string;
  by: string;
  /** Abrangência em que foi tomada (rastreabilidade do lote). */
  scope: ReviewScope;
  /** Tipo de ausência (decisão "absence"). */
  absenceType?: string;
}

export interface ReviewDay {
  employeeId: string;
  date: string;
  /** Segmentos da escala publicada; null = sem escala publicada. */
  planned: TimeRange[] | null;
  /** Pausa não remunerada prevista dentro do turno (minutos). */
  unpaidBreakMinutes?: number;
  dayOff?: boolean;
  holiday?: boolean;
  /** Ausência aprovada (férias, baixa…): nunca gera horas trabalhadas. */
  absence?: string | null;
  punches: Punch[];
  /** Calculado pelo motor atual (fonte única). */
  workedMinutes: number;
  plannedMinutes: number;
  /** Fase do dia em relação ao "agora". */
  phase: "done" | "in_progress" | "future";
  /** Dia num período fechado (Fecho). */
  closed?: boolean;
  review?: DayReview | null;
  /** Do servidor (fonte de verdade quando existe): estado, marcação incompleta, atraso e versão gravada. */
  state?: ReviewState;
  incomplete?: boolean;
  lateMinutes?: number;
  version?: number | null;
}

/** Pedido de aplicação de uma decisão (um lote auditado no servidor). */
export interface ConferenceApplyInput {
  decision: ReviewDecision;
  scope: ReviewScope;
  items: { employeeId: string; workDate: string; version: number | null }[];
  reason: string;
  declared: boolean;
  manual: { start: string; end: string; breakMinutes: number } | null;
  absenceType: string | null;
}

/** Resposta do servidor: o que aplicou, o que ficou revisto sem mudar horas e o que saltou (com motivo). */
export interface ConferenceResult {
  batchId: string;
  applied: { employeeId: string; workDate: string; reviewId: string }[];
  kept: { employeeId: string; workDate: string; reviewId: string }[];
  skipped: { employeeId: string; workDate: string; reason: string; label: string }[];
}

export interface ReviewPerson {
  id: string;
  name: string;
  location: string;
  photoUrl?: string | null;
}

export interface ReviewWeek {
  from: string;
  to: string;
  people: ReviewPerson[];
  days: ReviewDay[];
}

/** Estado da conferência (não confundir com o estado operacional "a trabalhar/saiu"). */
export type ReviewState =
  | "ok"
  | "review"
  | "late"
  | "absent"
  | "justified"
  | "in_progress"
  | "day_off"
  | "no_schedule"
  | "future"
  | "reviewed";

export type ReviewScope = "day" | "selected" | "week";

/** Porquê um dia não entra numa decisão. */
export type ExclusionReason =
  | "closed"
  | "in_progress"
  | "future"
  | "day_off"
  | "absence"
  | "no_schedule"
  | "schedule_exception"
  | "no_punches"
  | "single_punch"
  | "overtime"
  | "has_work"
  | "already_ok"
  | "already_reviewed"
  | "batch_manual";

export type Bucket = "apply" | "already" | "excluded" | "individual";

export interface Classified {
  day: ReviewDay;
  bucket: Bucket;
  reason?: ExclusionReason;
  /** Minutos validados antes → depois (só "apply"). */
  before: number;
  after: number;
}
