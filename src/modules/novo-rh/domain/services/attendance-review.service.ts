import type { Bucket, Classified, ExclusionReason, ReviewDay, ReviewDecision, ReviewState, TimeRange } from "../entities/attendance-review.ts";

/**
 * Regras puras da conferência V2. O cálculo de horas continua a ser do motor
 * atual (os minutos chegam já calculados); aqui só se decide o estado de
 * cada dia e o que cada decisão pode fazer em cada dia (com o motivo quando
 * não pode). Nada aqui inventa horas: "cumpriu" usa os segmentos publicados,
 * "manter" usa o registado e uma ausência nunca gera trabalho.
 */

/** Tolerância de atraso (minutos) — na integração vem da política da empresa/centro. */
export const DEFAULT_TOLERANCE = 5;

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};

/** Duração de uma faixa; fim ≤ início = passa a meia-noite. */
export const rangeMinutes = (r: TimeRange) => {
  const d = toMin(r.end) - toMin(r.start);
  return d <= 0 ? d + 1440 : d;
};

/** Minutos planeados: soma dos segmentos (repartidos), menos a pausa não remunerada. */
export const plannedMinutesOf = (planned: TimeRange[] | null, unpaidBreak = 0) =>
  planned ? Math.max(0, planned.reduce((s, r) => s + rangeMinutes(r), 0) - unpaidBreak) : 0;

const entries = (d: ReviewDay) => d.punches.filter((p) => p.kind === "in");
const exits = (d: ReviewDay) => d.punches.filter((p) => p.kind === "out");

/** Atraso da primeira entrada face ao início do primeiro segmento (minutos; 0 se não houver). O do servidor prevalece. */
export function lateMinutes(d: ReviewDay): number {
  if (d.lateMinutes !== undefined) return d.lateMinutes;
  const first = entries(d)[0];
  if (!d.planned?.length || !first || first.nextDay) return 0;
  return Math.max(0, toMin(first.at) - toMin(d.planned[0]!.start));
}

/** Há entrada sem saída (ou vice-versa): marcação incompleta. O do servidor prevalece. */
export const incomplete = (d: ReviewDay) => d.incomplete ?? (d.punches.length > 0 && entries(d).length !== exits(d).length);

export function dayState(d: ReviewDay, tol = DEFAULT_TOLERANCE): ReviewState {
  // O servidor aplica a tolerância da empresa/centro: o estado dele é o que conta.
  if (d.state) return d.state;
  if (d.review) return "reviewed";
  if (d.absence) return "justified";
  if (!d.planned && (d.dayOff || d.holiday) && !d.punches.length) return "day_off";
  if (d.phase === "future") return "future";
  if (!d.planned) {
    if (d.dayOff || d.holiday) return d.punches.length ? "review" : "day_off";
    return "no_schedule";
  }
  if (d.phase === "in_progress") return "in_progress";
  if (!d.punches.length) return "absent";
  if (incomplete(d)) return "review";
  if (lateMinutes(d) > tol) return "late";
  if (Math.abs(d.workedMinutes - d.plannedMinutes) > tol) return "review";
  return "ok";
}

/** Precisa da atenção do gestor (entra em "Pendências"). */
export const isPending = (d: ReviewDay) => {
  const s = dayState(d);
  return s === "review" || s === "late" || s === "absent" || (s === "no_schedule" && d.punches.length > 0);
};

/** Ordem da fila de pendências: faltas, marcações incompletas/divergências, exceções de escala, atrasos. */
export const pendingPriority = (d: ReviewDay) => {
  const s = dayState(d);
  if (s === "absent") return 0;
  if (s === "review" && incomplete(d)) return 1;
  if (s === "review") return 2;
  if (s === "no_schedule") return 3;
  return 4;
};

const out = (day: ReviewDay, bucket: Bucket, reason?: ExclusionReason, after = day.workedMinutes): Classified => ({
  day,
  bucket,
  ...(reason && { reason }),
  before: day.workedMinutes,
  after,
});

/**
 * O que uma decisão faz a um dia. `batch` = mais de um dia em causa: os casos
 * que exigem olhar para o dia (sem picagens, picagem única, correção manual)
 * passam para "revisão individual" em vez de serem aplicados às cegas.
 */
export function classifyDay(d: ReviewDay, decision: ReviewDecision, batch: boolean, tol = DEFAULT_TOLERANCE): Classified {
  if (d.review) return out(d, "already", "already_reviewed");
  if (d.closed) return out(d, "excluded", "closed");
  if (!d.planned && (d.dayOff || d.holiday) && !d.punches.length && decision !== "absence") return out(d, "excluded", "day_off");
  if (d.phase === "in_progress") return out(d, "excluded", "in_progress");
  if (d.phase === "future") return out(d, "excluded", "future");
  const state = dayState(d, tol);

  if (decision === "absence") {
    if (d.absence) return out(d, "already", "absence");
    if (!d.planned) return out(d, "excluded", d.dayOff || d.holiday ? "day_off" : "no_schedule");
    // Houve trabalho registado: marcar ausência nesse dia pede olhar para ele.
    if (d.workedMinutes > 0 && batch) return out(d, "individual", "has_work");
    return out(d, "apply", undefined, 0);
  }
  if (d.absence) return out(d, "excluded", "absence");
  if (!d.planned) {
    if (d.dayOff || d.holiday) return out(d, "excluded", "day_off");
    return out(d, "excluded", d.punches.length ? "schedule_exception" : "no_schedule");
  }
  if (decision === "manual") return batch ? out(d, "individual", "batch_manual") : out(d, "apply");
  if (decision === "keep") return state === "ok" ? out(d, "already", "already_ok") : out(d, "apply");

  // Cumpriu o horário planeado.
  if (state === "ok") return out(d, "already", "already_ok");
  if (d.workedMinutes > d.plannedMinutes + tol) return out(d, "excluded", "overtime");
  if (!d.punches.length) return batch ? out(d, "individual", "no_punches") : out(d, "apply", undefined, d.plannedMinutes);
  if (incomplete(d) && batch) return out(d, "individual", "single_punch");
  return out(d, "apply", undefined, d.plannedMinutes);
}

export const classify = (days: ReviewDay[], decision: ReviewDecision, tol = DEFAULT_TOLERANCE) =>
  days.map((d) => classifyDay(d, decision, days.length > 1, tol));

export interface WeekTotals {
  planned: number;
  /** Dias revistos ou conformes. */
  validated: number;
  /** Registado em dias ainda por conferir (provisório). */
  provisional: number;
  pending: number;
}

export function weekTotals(days: ReviewDay[]): WeekTotals {
  const t: WeekTotals = { planned: 0, validated: 0, provisional: 0, pending: 0 };
  for (const d of days) {
    t.planned += d.plannedMinutes;
    const s = dayState(d);
    if (d.review) t.validated += d.review.validatedMinutes;
    else if (s === "ok") t.validated += d.workedMinutes;
    else if (d.phase !== "future") t.provisional += d.workedMinutes;
    if (isPending(d)) t.pending += 1;
  }
  return t;
}

/** "7h52", "−0h21". */
export function formatMinutes(m: number, signed = false): string {
  const sign = m < 0 ? "−" : signed && m > 0 ? "+" : "";
  const a = Math.abs(Math.round(m));
  return `${sign}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
}

export const rangesLabel = (planned: TimeRange[] | null) => (planned ? planned.map((r) => `${r.start}–${r.end}`).join(" · ") : "—");
