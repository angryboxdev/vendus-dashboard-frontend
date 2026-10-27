import type { CashFlowDay, CashFlowReport } from "../entities/cash-flow.ts";

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MONTHS_SHORT = ["jan.", "fev.", "mar.", "abr.", "mai.", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];

export const monthName = (month: number) => MONTHS[month - 1] ?? "";
export const monthShort = (month: number) => MONTHS_SHORT[month - 1] ?? "";

const dayOf = (iso: string) => Number(iso.slice(8, 10));
const monthOf = (iso: string) => Number(iso.slice(5, 7));

/** Ponto do gráfico: valores acumulados até ao dia, em euros; ausentes depois do último dia com dados. */
export interface CashFlowChartRow {
  day: number;
  inflow?: number;
  outflow?: number;
  previousInflow?: number;
  previousOutflow?: number;
}

function cumulative(days: CashFlowDay[]): Map<number, { inflow: number; outflow: number }> {
  const out = new Map<number, { inflow: number; outflow: number }>();
  let inflow = 0;
  let outflow = 0;
  for (const d of days) {
    inflow += d.inflowCents;
    outflow += d.outflowCents;
    out.set(dayOf(d.date), { inflow: inflow / 100, outflow: outflow / 100 });
  }
  return out;
}

/**
 * Linhas do gráfico, uma por dia do mês: entradas e saídas acumuladas do mês (até hoje) e do
 * período anterior, alinhadas pelo dia do mês.
 */
export function chartRows(report: CashFlowReport): CashFlowChartRow[] {
  const current = cumulative(report.days);
  const previous = cumulative(report.previousDays);
  const lastDay = dayOf(report.period.monthEnd);
  const rows: CashFlowChartRow[] = [];
  for (let day = 1; day <= lastDay; day++) {
    const c = current.get(day);
    const p = previous.get(day);
    rows.push({ day, inflow: c?.inflow, outflow: c?.outflow, previousInflow: p?.inflow, previousOutflow: p?.outflow });
  }
  return rows;
}

/** Variação em % (inteiro) de `previous` para `current`; null sem base de comparação. */
export function pctChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** «1–16 out.» */
export function windowLabel(from: string, to: string): string {
  const a = dayOf(from);
  const b = dayOf(to);
  return `${a === b ? a : `${a}–${b}`} ${monthShort(monthOf(to))}`;
}

/** Totais acumulados até um dia do mês (para o tooltip), no mês e no período anterior. */
export function totalsUntil(report: CashFlowReport, day: number) {
  const sum = (days: CashFlowDay[]) =>
    days
      .filter((d) => dayOf(d.date) <= day)
      .reduce((a, d) => ({ inflow: a.inflow + d.inflowCents, outflow: a.outflow + d.outflowCents }), { inflow: 0, outflow: 0 });
  const prevDays = report.previousDays;
  const prevLast = prevDays.length > 0 ? dayOf(prevDays[prevDays.length - 1]!.date) : 0;
  return {
    current: sum(report.days),
    previous: sum(prevDays),
    currentLabel: windowLabel(report.period.from, `${report.period.from.slice(0, 8)}${String(day).padStart(2, "0")}`),
    previousLabel:
      prevLast > 0
        ? windowLabel(report.period.previous.from, `${report.period.previous.from.slice(0, 8)}${String(Math.min(day, prevLast)).padStart(2, "0")}`)
        : null,
  };
}

/** Parte de `part` em `total`, em % inteiro. */
export function sharePct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Mês escolhido ainda não começou (o servidor recusa). */
export function isFutureMonth(year: number, month: number, today: Date): boolean {
  return year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1);
}
