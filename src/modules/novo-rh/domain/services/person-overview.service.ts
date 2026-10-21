import type { AbsenceRequest, Balance } from "../entities/absences.ts";
import type { AttendanceDays } from "../entities/attendance.ts";

/**
 * Ficha do colaborador (redesign premium): contas só de apresentação sobre os
 * dados que já chegam do servidor — calendário anual das ausências e barras das
 * Estatísticas. Nada aqui recalcula o motor de ponto nem os saldos.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const addDays = (date: string, n: number) => {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};

/** Semanas (segunda a domingo) de um mês; `null` nos dias de fora do mês. */
export function monthWeeks(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(iso(new Date(Date.UTC(year, month - 1, d))));
  while (cells.length % 7) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export const isWeekend = (date: string) => [0, 6].includes(utc(date).getUTCDay());

export interface CalendarMark {
  status: "approved" | "pending";
  typeName: string;
  color: string | null;
  halfDay: boolean;
}

/**
 * Dia → ausência marcada no calendário (aprovadas e pendentes; recusadas e
 * canceladas não aparecem). Se dois pedidos tocam o mesmo dia, ganha o aprovado.
 */
export function absenceMarks(requests: AbsenceRequest[], from: string, to: string): Map<string, CalendarMark> {
  const marks = new Map<string, CalendarMark>();
  for (const r of requests) {
    if (r.status !== "approved" && r.status !== "pending") continue;
    const start = r.startDate < from ? from : r.startDate;
    const end = r.endDate > to ? to : r.endDate;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      const cur = marks.get(d);
      if (cur?.status === "approved") continue;
      marks.set(d, { status: r.status, typeName: r.typeName, color: r.typeColor, halfDay: r.halfDay });
    }
  }
  return marks;
}

/** Resumo de um saldo para os cartões (direito = atribuído + ajustes). */
export function balanceSummary(b: Balance) {
  return { total: b.accrued + b.adjusted, used: b.used, pending: b.pending, available: b.available };
}

export type StatsPreset = "month" | "quarter" | "year";

/** Intervalo de cada período das Estatísticas, sempre a terminar hoje. */
export function statsRange(preset: StatsPreset, today: string): { from: string; to: string; bucket: "day" | "week" | "month" } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today, bucket: "day" };
  if (preset === "quarter") return { from: iso(new Date(Date.UTC(y, m - 3, 1))), to: today, bucket: "week" };
  return { from: `${y}-01-01`, to: today, bucket: "month" };
}

export interface StatsBucket {
  key: string;
  label: string;
  worked: number;
  theoretical: number;
  missing: number;
  late: number;
}

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const mondayOf = (date: string) => addDays(date, -((utc(date).getUTCDay() + 6) % 7));

/** Dias do apuramento agrupados em barras (dia, semana a começar à segunda, ou mês). */
export function statsBuckets(data: AttendanceDays, bucket: "day" | "week" | "month"): StatsBucket[] {
  const out = new Map<string, StatsBucket>();
  for (const d of data.days) {
    const key = bucket === "day" ? d.workDate : bucket === "week" ? mondayOf(d.workDate) : d.workDate.slice(0, 7);
    const label =
      bucket === "day" ? String(Number(d.workDate.slice(8))) : bucket === "week" ? `${key.slice(8)}/${key.slice(5, 7)}` : MONTHS[Number(key.slice(5, 7)) - 1]!;
    const b = out.get(key) ?? { key, label, worked: 0, theoretical: 0, missing: 0, late: 0 };
    b.worked += d.workedSeconds;
    b.theoretical += d.theoreticalSeconds;
    if (d.incidents.includes("missing_in")) b.missing += 1;
    if (d.incidents.includes("late")) b.late += 1;
    out.set(key, b);
  }
  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Percentagem inteira de `part` em `whole` (0 quando não há base). */
export const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
