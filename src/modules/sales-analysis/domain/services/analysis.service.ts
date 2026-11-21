import {
  OPENING_HOUR, closingHour,
  type CompactBucket, type IsoDate, type SalesAnalysisData, type SalesChannel,
} from "../entities/sales-analysis.ts";
import { WEEK_ORDER, dayCount, eachDay, shiftMonth, weekdayOf } from "./periods.ts";

/**
 * Cálculos da Análise de Vendas a partir dos blocos devolvidos pelo backend.
 * Funções puras (sem React nem rede).
 */

export interface Bucket {
  date: IsoDate;
  hour: number;
  channel: SalesChannel;
  grossCents: number;
  netCents: number;
  count: number;
}

export function expand(rows: CompactBucket[], channels: SalesChannel[]): Bucket[] {
  return rows.flatMap(([date, hour, ci, grossCents, netCents, count]) => {
    const channel = channels[ci];
    return channel ? [{ date, hour, channel, grossCents, netCents, count }] : [];
  });
}

export interface Totals {
  grossCents: number;
  netCents: number;
  count: number;
  avgTicketCents: number;
  avgDailyCents: number;
  avgDailyCount: number;
}

export interface DayStat {
  date: IsoDate;
  grossCents: number;
  netCents: number;
  count: number;
  prevYearGrossCents: number;
  prevMonthGrossCents: number;
  prevMonthCount: number;
}

export interface HourStat {
  hour: number;
  grossCents: number;
  count: number;
  avgPerDayCents: number;
  avgCountPerDay: number;
  /** Antes da abertura em todos os dias (antes das 12h). */
  outside: boolean;
}

export interface ChannelStat {
  channel: SalesChannel;
  grossCents: number;
  prevYearGrossCents: number;
  count: number;
  share: number;
  peakHour: number | null;
}

export interface Analysis {
  totals: Totals;
  prevYear: Totals;
  days: DayStat[];
  strongest: DayStat;
  weakest: DayStat;
  zeroDays: IsoDate[];
  weekday: { weekday: number; days: number; avgCents: number; avgCount: number; prevYearAvgCents: number }[];
  hours: HourStat[];
  peakHour: HourStat | null;
  weakestHour: HourStat | null;
  silentSlots: { weekday: number; hour: number }[];
  outsideHoursCents: number;
  outsideHoursCount: number;
  /** [dia da semana][índice em `hours`] — média por dia. */
  heat: number[][];
  heatCount: number[][];
  heatMax: number;
  channels: ChannelStat[];
}

/** Hora fora do horário de funcionamento nesse dia da semana. */
export function isOutsideHours(weekday: number, hour: number): boolean {
  return hour < OPENING_HOUR || hour >= Math.ceil(closingHour(weekday));
}

function sum(bs: Bucket[]) {
  return bs.reduce((a, b) => ({ g: a.g + b.grossCents, n: a.n + b.netCents, c: a.c + b.count }), { g: 0, n: 0, c: 0 });
}

function totals(bs: Bucket[], nDays: number): Totals {
  const s = sum(bs);
  return { grossCents: s.g, netCents: s.n, count: s.c, avgTicketCents: s.c > 0 ? s.g / s.c : 0, avgDailyCents: s.g / nDays, avgDailyCount: s.c / nDays };
}

/** Horas mostradas: 11h–23h, alargadas se houver vendas fora desse intervalo. */
export function hoursShown(bs: Bucket[]): number[] {
  let min = 11;
  let max = 23;
  for (const b of bs) if (b.hour >= 0) { min = Math.min(min, b.hour); max = Math.max(max, b.hour); }
  return Array.from({ length: max - min + 1 }, (_, i) => min + i);
}

export function buildAnalysis(data: SalesAnalysisData): Analysis {
  const cur = expand(data.current, data.channels);
  const py = expand(data.prevYear, data.channels);
  const pm = expand(data.prevMonth, data.channels);
  const range = data.range;
  const nDays = dayCount(range);

  const dayMap = new Map<IsoDate, DayStat>();
  for (const date of eachDay(range)) dayMap.set(date, { date, grossCents: 0, netCents: 0, count: 0, prevYearGrossCents: 0, prevMonthGrossCents: 0, prevMonthCount: 0 });
  for (const b of cur) {
    const d = dayMap.get(b.date);
    if (d) { d.grossCents += b.grossCents; d.netCents += b.netCents; d.count += b.count; }
  }
  // Ano anterior e mês anterior: o mesmo dia de calendário (31 sem par fica a zero).
  for (const b of py) {
    const d = dayMap.get(shiftMonth(b.date, 12));
    if (d && shiftMonth(d.date, -12) === b.date) d.prevYearGrossCents += b.grossCents;
  }
  for (const b of pm) {
    const d = dayMap.get(shiftMonth(b.date, 1));
    if (d && shiftMonth(d.date, -1) === b.date) { d.prevMonthGrossCents += b.grossCents; d.prevMonthCount += b.count; }
  }
  const days = [...dayMap.values()];
  const strongest = days.reduce((a, b) => (b.grossCents > a.grossCents ? b : a));
  const weakest = days.reduce((a, b) => (b.grossCents < a.grossCents ? b : a));
  const zeroDays = days.filter((d) => d.grossCents === 0).map((d) => d.date);

  const weekday = WEEK_ORDER.map((wd) => {
    const ds = days.filter((d) => weekdayOf(d.date) === wd);
    const n = ds.length || 1;
    return {
      weekday: wd,
      days: ds.length,
      avgCents: ds.reduce((a, d) => a + d.grossCents, 0) / n,
      avgCount: ds.reduce((a, d) => a + d.count, 0) / n,
      prevYearAvgCents: ds.reduce((a, d) => a + d.prevYearGrossCents, 0) / n,
    };
  });

  const hourList = hoursShown(cur);
  const hours: HourStat[] = hourList.map((h) => {
    const s = sum(cur.filter((b) => b.hour === h));
    return { hour: h, grossCents: s.g, count: s.c, avgPerDayCents: s.g / nDays, avgCountPerDay: s.c / nDays, outside: h < OPENING_HOUR };
  });
  const inside = hours.filter((h) => !h.outside && h.hour <= 23);
  const peakHour = inside.length ? inside.reduce((a, b) => (b.grossCents > a.grossCents ? b : a)) : null;
  const weakestHour = inside.length ? inside.reduce((a, b) => (b.grossCents < a.grossCents ? b : a)) : null;
  const outsideBs = cur.filter((b) => isOutsideHours(weekdayOf(b.date), b.hour));

  const heat = Array.from({ length: 7 }, () => hourList.map(() => 0));
  const heatCount = Array.from({ length: 7 }, () => hourList.map(() => 0));
  const daysPerWeekday = Array.from({ length: 7 }, (_, wd) => days.filter((d) => weekdayOf(d.date) === wd).length);
  for (const b of cur) {
    const i = hourList.indexOf(b.hour);
    const wd = weekdayOf(b.date);
    if (i >= 0) { heat[wd]![i]! += b.grossCents; heatCount[wd]![i]! += b.count; }
  }
  let heatMax = 0;
  for (let wd = 0; wd < 7; wd++) {
    const n = daysPerWeekday[wd] || 1;
    for (let i = 0; i < hourList.length; i++) {
      heat[wd]![i]! /= n;
      heatCount[wd]![i]! /= n;
      heatMax = Math.max(heatMax, heat[wd]![i]!);
    }
  }

  const silentSlots: { weekday: number; hour: number }[] = [];
  for (const wd of WEEK_ORDER) {
    if (!daysPerWeekday[wd]) continue;
    for (let h = OPENING_HOUR; h < Math.ceil(closingHour(wd)); h++) {
      const i = hourList.indexOf(h);
      if (i >= 0 && heatCount[wd]![i]! <= 0 && heat[wd]![i]! <= 0) silentSlots.push({ weekday: wd, hour: h });
    }
  }

  const t = totals(cur, nDays);
  const channels: ChannelStat[] = data.channels.map((ch) => {
    const bs = cur.filter((b) => b.channel === ch);
    const s = sum(bs);
    let peak: number | null = null;
    let best = 0;
    for (const h of hourList) {
      const g = bs.filter((b) => b.hour === h).reduce((a, b) => a + b.grossCents, 0);
      if (g > best) { best = g; peak = h; }
    }
    return { channel: ch, grossCents: s.g, prevYearGrossCents: sum(py.filter((b) => b.channel === ch)).g, count: s.c, share: t.grossCents ? s.g / t.grossCents : 0, peakHour: peak };
  });

  return {
    totals: t,
    prevYear: totals(py, nDays),
    days,
    strongest,
    weakest,
    zeroDays,
    weekday,
    hours,
    peakHour,
    weakestHour,
    silentSlots,
    outsideHoursCents: sum(outsideBs).g,
    outsideHoursCount: sum(outsideBs).c,
    heat,
    heatCount,
    heatMax,
    channels,
  };
}

// ─── Detalhe (painel lateral) ────────────────────────────────────────────────

export interface HourRow {
  hour: number;
  grossCents: number;
  count: number;
  byChannel: Partial<Record<SalesChannel, number>>;
}

/** Linhas por hora de um conjunto de blocos, divididas por `divideBy` (médias). */
export function hourRows(bs: Bucket[], hourList: number[], divideBy = 1): HourRow[] {
  return hourList.map((h) => {
    const rs = bs.filter((b) => b.hour === h);
    const byChannel: HourRow["byChannel"] = {};
    for (const r of rs) byChannel[r.channel] = (byChannel[r.channel] ?? 0) + r.count / divideBy;
    return { hour: h, grossCents: rs.reduce((s, r) => s + r.grossCents, 0) / divideBy, count: rs.reduce((s, r) => s + r.count, 0) / divideBy, byChannel };
  });
}

export function currentBuckets(data: SalesAnalysisData): Bucket[] {
  return expand(data.current, data.channels);
}
