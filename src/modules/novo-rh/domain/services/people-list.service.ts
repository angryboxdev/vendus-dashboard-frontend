import type { PersonDayView } from "../entities/overview.ts";

/**
 * Lista de pessoas — colunas «Horário» e «Horas hoje». Só formata valores do
 * servidor (a mesma vista do dia da Visão geral): nunca calcula horas nem
 * pausas, e um dia sem dados mostra «—», nunca um 0 inventado.
 */

export type TodaySchedule =
  | { kind: "hours"; text: string }
  /** Previsto sem hora de início/fim (horário flexível). */
  | { kind: "flexible"; theoreticalSeconds: number }
  | { kind: "day_off" }
  | { kind: "absent"; absenceType: string | null }
  | { kind: "none" }
  | { kind: "unknown" };

export function todaySchedule(day: PersonDayView | undefined): TodaySchedule {
  if (!day) return { kind: "unknown" };
  if (day.status === "absent") return { kind: "absent", absenceType: day.absenceType };
  if (day.plannedStart) return { kind: "hours", text: `${day.plannedStart}–${day.plannedEnd ?? "?"}` };
  if (day.status === "day_off") return { kind: "day_off" };
  return day.theoreticalSeconds > 0 ? { kind: "flexible", theoreticalSeconds: day.theoreticalSeconds } : { kind: "none" };
}

export interface TodayHours {
  workedSeconds: number;
  theoreticalSeconds: number;
  /** 0–1 para a barra (trabalhado / previsto); null sem previsto. */
  ratio: number | null;
}

export function todayHours(day: PersonDayView | undefined): TodayHours | null {
  if (!day) return null;
  const ratio = day.theoreticalSeconds > 0 ? Math.min(1, Math.max(0, day.workedSeconds / day.theoreticalSeconds)) : null;
  return { workedSeconds: day.workedSeconds, theoreticalSeconds: day.theoreticalSeconds, ratio };
}

/** «40h semana» / «37,5h semana» — horas do contrato vigente; null sem contrato. */
export function weeklyHoursLabel(hours: number | null | undefined): string | null {
  if (hours === null || hours === undefined) return null;
  return `${String(hours).replace(".", ",")}h`;
}

/**
 * Colunas guardadas no navegador + colunas novas por omissão: quem já tinha
 * escolhido colunas passa a ver as novas uma vez (depois decide), sem perder
 * a escolha anterior.
 */
export function mergeStoredColumns<C extends string>(stored: unknown, all: readonly C[], defaults: readonly C[], introduced: readonly C[]): C[] | null {
  if (Array.isArray(stored)) {
    // Formato antigo (só a lista): as colunas introduzidas depois ainda não foram vistas.
    return all.filter((c) => stored.includes(c) || introduced.includes(c));
  }
  if (stored && typeof stored === "object" && Array.isArray((stored as { cols?: unknown }).cols)) {
    const { cols, known } = stored as { cols: unknown[]; known?: unknown[] };
    const seen = Array.isArray(known) ? known : [];
    return all.filter((c) => cols.includes(c) || (!seen.includes(c) && defaults.includes(c)));
  }
  return null;
}
