import type { DateRange, IsoDate } from "../entities/sales-analysis.ts";

/** Datas de calendário (AAAA-MM-DD) e atalhos de período. Funções puras. */

export type Preset = "this_month" | "last_month" | "this_year" | "custom";
export const MAX_RANGE_DAYS = 366;

const pad = (n: number) => String(n).padStart(2, "0");

export function addDays(d: IsoDate, n: number): IsoDate {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function dayCount(r: DateRange): number {
  return Math.round((Date.parse(`${r.to}T00:00:00Z`) - Date.parse(`${r.from}T00:00:00Z`)) / 86_400_000) + 1;
}

export function eachDay(r: DateRange): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function shiftMonth(d: IsoDate, by: number): IsoDate {
  const [y = 0, m = 1, dd = 1] = d.split("-").map(Number);
  const idx = y * 12 + (m - 1) + by;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(dd, daysInMonth(ny, nm)))}`;
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(d: IsoDate): number {
  return new Date(`${d}T00:00:00Z`).getUTCDay();
}

export function presetRange(p: Preset, custom: DateRange, today: IsoDate): DateRange {
  const month = today.slice(0, 7);
  switch (p) {
    case "this_month":
      return { from: `${month}-01`, to: today };
    case "last_month": {
      const first = shiftMonth(`${month}-01`, -1);
      const [y = 0, m = 1] = first.split("-").map(Number);
      return { from: first, to: `${first.slice(0, 7)}-${pad(daysInMonth(y, m))}` };
    }
    case "this_year":
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "custom":
      return custom;
  }
}

/** null = válido; senão a mensagem a mostrar. */
export function rangeProblem(r: DateRange, today: IsoDate): string | null {
  if (!r.from || !r.to) return "Escolha as duas datas.";
  if (r.from > r.to) return "A data inicial é posterior à final.";
  if (r.to > today) return "O período não pode terminar depois de hoje.";
  if (dayCount(r) > MAX_RANGE_DAYS) return "O período máximo é de 12 meses.";
  return null;
}

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
/** Ordem de apresentação: segunda a domingo. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function fmtDate(d: IsoDate, withWeekday = true): string {
  const [y, m, dd] = d.split("-");
  const base = `${dd}/${m}/${y}`;
  return withWeekday ? `${WEEKDAYS_SHORT[weekdayOf(d)]}, ${base}` : base;
}

export function monthLabel(ym: string): string {
  const [y = 0, m = 1] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("pt-PT", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function eur(cents: number, decimals = 0): string {
  return (cents / 100).toLocaleString("pt-PT", { style: "currency", currency: "EUR", minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function delta(cur: number, prev: number): number | null {
  return prev ? cur / prev - 1 : null;
}

export function pct(v: number | null): string {
  if (v === null || !Number.isFinite(v)) return "—";
  return `${v >= 0 ? "+" : ""}${(v * 100).toFixed(1).replace(".", ",")} %`;
}

export function fmtCount(n: number): string {
  return n < 10 && !Number.isInteger(n) ? n.toFixed(1).replace(".", ",") : Math.round(n).toLocaleString("pt-PT");
}

/** Hoje em Lisboa (AAAA-MM-DD). en-CA formata como AAAA-MM-DD. */
export function lisbonToday(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
