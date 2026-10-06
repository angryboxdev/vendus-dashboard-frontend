import type { CalendarItem } from "../entities/calendar-item.ts";

/** Datas sempre em AAAA-MM-DD, calculadas em UTC para não depender do fuso do browser. */
export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function parseYmd(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

export function addDays(value: string, days: number): string {
  const d = parseYmd(value);
  d.setUTCDate(d.getUTCDate() + days);
  return ymd(d);
}

/** Segunda-feira da semana de `value` (semana começa à segunda, como no resto do RH). */
export function startOfWeek(value: string): string {
  const d = parseYmd(value);
  const weekday = (d.getUTCDay() + 6) % 7; // 0 = segunda
  return addDays(value, -weekday);
}

export function firstOfMonth(value: string): string {
  return `${value.slice(0, 7)}-01`;
}

export function addMonths(value: string, months: number): string {
  const d = parseYmd(firstOfMonth(value));
  d.setUTCMonth(d.getUTCMonth() + months);
  return ymd(d);
}

/** Semanas (7 dias, segunda a domingo) que cobrem o mês inteiro de `value`. */
export function monthGrid(value: string): string[][] {
  const first = firstOfMonth(value);
  const last = addDays(addMonths(first, 1), -1);
  const weeks: string[][] = [];
  for (let cursor = startOfWeek(first); cursor <= last; cursor = addDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(cursor, i)));
  }
  return weeks;
}

export function weekDays(value: string): string[] {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Intervalo a pedir ao backend para a vista atual. */
export function visibleRange(mode: "month" | "week", value: string): { from: string; to: string } {
  if (mode === "week") {
    const days = weekDays(value);
    return { from: days[0]!, to: days[6]! };
  }
  const weeks = monthGrid(value);
  return { from: weeks[0]![0]!, to: weeks[weeks.length - 1]![6]! };
}

export function itemsByDate(items: CalendarItem[]): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();
  for (const item of items) map.set(item.date, [...(map.get(item.date) ?? []), item]);
  return map;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT_MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

export function monthTitle(value: string): string {
  const name = MONTHS[Number(value.slice(5, 7)) - 1]!;
  return `${name[0]!.toUpperCase()}${name.slice(1)} ${value.slice(0, 4)}`;
}

/** "14 OUT" — formato do bloco "Próximos eventos importantes" (task §8). */
export function shortDate(value: string): string {
  return `${Number(value.slice(8, 10))} ${SHORT_MONTHS[Number(value.slice(5, 7)) - 1]}`;
}
