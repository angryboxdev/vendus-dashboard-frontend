/**
 * Seletor de período do Portal (pedir folga): 1.º toque = início, 2.º toque
 * = fim. Um toque antes do início recomeça; nunca dias passados nem mais de
 * `maxDays` seguidos (o servidor aplica a mesma regra).
 */
export interface PickedPeriod {
  start: string | null;
  end: string | null;
}

const toUtc = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10)));

export function daysInclusive(start: string, end: string): number {
  return Math.round((toUtc(end) - toUtc(start)) / 86_400_000) + 1;
}

export function pickDay(current: PickedPeriod, day: string, opts: { today: string; maxDays: number }): PickedPeriod {
  if (day < opts.today) return current;
  if (!current.start || current.end || day < current.start) return { start: day, end: null };
  if (daysInclusive(current.start, day) > opts.maxDays) return { start: day, end: null };
  return { start: current.start, end: day };
}

/** Dia desativado: passado, ou longe demais do início escolhido (ainda sem fim). */
export function isDayDisabled(day: string, current: PickedPeriod, opts: { today: string; maxDays: number }): boolean {
  if (day < opts.today) return true;
  if (current.start && !current.end && day > current.start) return daysInclusive(current.start, day) > opts.maxDays;
  return false;
}

export function isInPeriod(day: string, p: PickedPeriod): boolean {
  if (!p.start) return false;
  const end = p.end ?? p.start;
  return day >= p.start && day <= end;
}

/** 6 semanas (segunda a domingo) que mostram o mês `YYYY-MM`. */
export function monthGrid(month: string): string[] {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(toUtc(`${month}-01`) + (i - offset) * 86_400_000).toISOString().slice(0, 10));
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export const monthTitle = (month: string) => `${MONTHS[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/** "09 Out 2026" */
export const shortDate = (ymd: string) => `${ymd.slice(8, 10)} ${SHORT[Number(ymd.slice(5, 7)) - 1]} ${ymd.slice(0, 4)}`;

/** "12 – 14 Out 2026", "03 Out 2026", "30 Set – 02 Out 2026" */
export function periodLabel(start: string, end: string): string {
  if (start === end) return shortDate(start);
  if (start.slice(0, 7) === end.slice(0, 7)) return `${start.slice(8, 10)} – ${shortDate(end)}`;
  return `${start.slice(8, 10)} ${SHORT[Number(start.slice(5, 7)) - 1]} – ${shortDate(end)}`;
}
