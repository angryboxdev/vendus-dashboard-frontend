import { LEAVE_TYPE_LABELS, type LeaveOverviewEntry, type PublicHoliday, type WorkShift } from "../entities/schedule.ts";

/**
 * "Rever e publicar" (regras puras). Não há motor de validação novo: os
 * alertas vêm do que já existe — sobreposições do `GET /alerts` do backend,
 * ausências e feriados já carregados pelas Escalas.
 */

const WEEKDAYS_UPPER = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"];
const MONTHS_UPPER = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

/** Nome curto já usado no calendário do RH (primeiros dois nomes). */
export function shortEmployeeName(fullName: string): string {
  return fullName.trim().split(/\s+/).slice(0, 2).join(" ");
}

/** "SEGUNDA · 05 OUT". */
export function reviewDayHeader(workDate: string): string {
  const [y, m, d] = workDate.split("-").map(Number) as [number, number, number];
  return `${WEEKDAYS_UPPER[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} · ${String(d).padStart(2, "0")} ${MONTHS_UPPER[m - 1]}`;
}

/** "10:00–18:00", "12:00–15:00 · 18:00–23:59", "20:00–00:00 (+1)". */
export function reviewShiftHours(s: Pick<WorkShift, "startTime" | "endTime" | "secondStartTime" | "secondEndTime" | "endsNextDay">): string {
  const first = `${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`;
  if (s.secondStartTime && s.secondEndTime) return `${first} · ${s.secondStartTime.slice(0, 5)}–${s.secondEndTime.slice(0, 5)}`;
  return s.endsNextDay ? `${first} (+1)` : first;
}

export interface ReviewContext {
  /** Turnos em sobreposição (do `ScheduleAlerts.overlaps` do backend). */
  overlapShiftIds: ReadonlySet<string>;
  leaves: LeaveOverviewEntry[];
  holidays: PublicHoliday[];
}

export interface ReviewShift {
  shift: WorkShift;
  shortName: string;
  hours: string;
  split: boolean;
  /** Ocorrências já suportadas (sobreposição, ausência, feriado). */
  alerts: string[];
  /** Local só aparece na linha quando difere do comum ao dia. */
  showLocation: boolean;
}

export interface ReviewDay {
  workDate: string;
  header: string;
  shifts: ReviewShift[];
  /** Local de todos os turnos do dia, se for o mesmo — mostrado só no cabeçalho. */
  commonLocationId: string | null;
  alertCount: number;
}

/** Só rascunhos, por dia (por ordem), dentro de cada dia por colaborador e hora. */
export function buildReviewDays(shifts: WorkShift[], ctx: ReviewContext): ReviewDay[] {
  const drafts = shifts.filter((s) => s.status === "draft");
  const days = [...new Set(drafts.map((s) => s.workDate))].sort();
  return days.map((workDate) => {
    const dayShifts = drafts
      .filter((s) => s.workDate === workDate)
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "pt") || a.startTime.localeCompare(b.startTime));
    const locations = new Set(dayShifts.map((s) => s.locationId));
    const commonLocationId = locations.size === 1 ? dayShifts[0]!.locationId : null;
    const holiday = ctx.holidays.find((h) => h.date === workDate);
    const rows = dayShifts.map((shift): ReviewShift => {
      const alerts: string[] = [];
      if (ctx.overlapShiftIds.has(shift.id)) alerts.push("Sobreposição");
      const leave = ctx.leaves.find((l) => l.employeeId === shift.employeeId && l.startDate <= workDate && l.endDate >= workDate);
      if (leave) alerts.push(`Ausência: ${LEAVE_TYPE_LABELS[leave.type]}`);
      if (holiday) alerts.push(`Feriado: ${holiday.name}`);
      return {
        shift,
        shortName: shortEmployeeName(shift.employeeName),
        hours: reviewShiftHours(shift),
        split: !!(shift.secondStartTime && shift.secondEndTime),
        alerts,
        showLocation: commonLocationId === null,
      };
    });
    return { workDate, header: reviewDayHeader(workDate), shifts: rows, commonLocationId, alertCount: rows.filter((r) => r.alerts.length > 0).length };
  });
}

export type CheckState = "all" | "some" | "none";

/** Estado de um grupo de turnos (dia ou todos) face aos desmarcados — "some" = checkbox indeterminada. */
export function selectionState(ids: string[], excluded: ReadonlySet<string>): CheckState {
  const off = ids.filter((id) => excluded.has(id)).length;
  if (off === 0) return "all";
  return off === ids.length ? "none" : "some";
}

/** "20 turnos · 7 dias · 5 colaboradores · 2 alertas" (calculado dos dados carregados). */
export function reviewSummary(days: ReviewDay[]): { shifts: number; days: number; employees: number; alerts: number } {
  const shifts = days.flatMap((d) => d.shifts);
  return {
    shifts: shifts.length,
    days: days.length,
    employees: new Set(shifts.map((s) => s.shift.employeeId)).size,
    alerts: days.reduce((n, d) => n + d.alertCount, 0),
  };
}

/** Dias com alertas abrem expandidos; com muitos dias (> 7), os restantes começam recolhidos. */
export function initiallyCollapsed(days: ReviewDay[]): Set<string> {
  if (days.length <= 7) return new Set();
  return new Set(days.filter((d) => d.alertCount === 0).map((d) => d.workDate));
}

/** Para o aviso logo a seguir a criar: quantos rascunhos e o período a rever. null = nada em rascunho. */
export function draftSummary(shifts: Pick<WorkShift, "status" | "workDate">[]): { count: number; range: { from: string; to: string } } | null {
  const dates = shifts.filter((s) => s.status === "draft").map((s) => s.workDate).sort();
  if (dates.length === 0) return null;
  return { count: dates.length, range: { from: dates[0]!, to: dates[dates.length - 1]! } };
}
