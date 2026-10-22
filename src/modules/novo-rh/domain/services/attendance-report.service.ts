import type { StatsBucket } from "./person-overview.service.ts";

/**
 * Relatório de assiduidade (Mais → Relatórios → Assiduidade): o servidor dá os
 * dias apurados em blocos de até 31 dias; aqui só se somam (por pessoa, por
 * semana, por mês ou no total) e se monta a tabela a mostrar/exportar.
 */

export interface ReportDay {
  employeeId: string;
  workDate: string;
  worked: number;
  planned: number;
  late: boolean;
  lateMinutes: number;
  missing: boolean;
  forgotten: boolean;
  excused: boolean;
}
export interface ReportPerson {
  id: string;
  name: string;
  locationId: string | null;
  hireDate: string | null;
}

export type ReportPreset = "week" | "month" | "lastMonth" | "year" | "since" | "custom";
export type ReportBucket = "total" | "week" | "month";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const addDays = (date: string, n: number) => {
  const d = utc(date);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const mondayOf = (date: string) => addDays(date, -((utc(date).getUTCDay() + 6) % 7));
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const ddmmyyyy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

/** «Desde a admissão» vai no máximo a dois anos atrás (o cálculo é ao vivo, dia a dia). */
export const SINCE_MAX_DAYS = 730;

/** Intervalo de um período; termina sempre hoje (ou no fim do mês anterior). */
export function reportRange(preset: Exclude<ReportPreset, "custom">, today: string, earliestHire: string | null): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  if (preset === "week") return { from: mondayOf(today), to: today };
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "lastMonth") return { from: iso(new Date(Date.UTC(y, m - 2, 1))), to: iso(new Date(Date.UTC(y, m - 1, 0))) };
  if (preset === "year") return { from: `${y}-01-01`, to: today };
  const floor = addDays(today, -SINCE_MAX_DAYS);
  return { from: earliestHire && earliestHire > floor ? earliestHire : floor, to: today };
}

/** Blocos de pedido: meses de calendário, nunca mais de 31 dias, sem passar de `to`. */
export function chunks(from: string, to: string): { from: string; to: string }[] {
  const out: { from: string; to: string }[] = [];
  let cur = from;
  while (cur <= to) {
    const [y, m] = cur.split("-").map(Number) as [number, number];
    const monthEnd = iso(new Date(Date.UTC(y, m, 0)));
    const end = monthEnd < to ? monthEnd : to;
    out.push({ from: cur, to: end });
    cur = addDays(end, 1);
  }
  return out;
}

export interface Totals {
  worked: number;
  planned: number;
  plannedDays: number;
  workedDays: number;
  late: number;
  lateMinutes: number;
  missing: number;
  forgotten: number;
  excused: number;
}
const empty = (): Totals => ({ worked: 0, planned: 0, plannedDays: 0, workedDays: 0, late: 0, lateMinutes: 0, missing: 0, forgotten: 0, excused: 0 });
function add(t: Totals, d: ReportDay) {
  t.worked += d.worked;
  t.planned += d.planned;
  if (d.planned > 0) t.plannedDays += 1;
  if (d.worked > 0) t.workedDays += 1;
  if (d.late) t.late += 1;
  t.lateMinutes += d.lateMinutes;
  if (d.missing) t.missing += 1;
  if (d.forgotten) t.forgotten += 1;
  if (d.excused) t.excused += 1;
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);
/** Cumprimento: horas trabalhadas face às planeadas. Pontualidade: dias trabalhados sem atraso. */
export const compliance = (t: Totals) => pct(t.worked, t.planned);
export const punctuality = (t: Totals) => (t.workedDays > 0 ? Math.round(((t.workedDays - Math.min(t.late, t.workedDays)) / t.workedDays) * 100) : null);

export function bucketKey(date: string, bucket: ReportBucket): { key: string; label: string } {
  if (bucket === "total") return { key: "total", label: "Total" };
  if (bucket === "week") {
    const k = mondayOf(date);
    return { key: k, label: `Semana de ${k.slice(8)}/${k.slice(5, 7)}` };
  }
  const k = date.slice(0, 7);
  return { key: k, label: `${MONTHS[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}` };
}

export interface ReportLine {
  person: ReportPerson;
  periodKey: string;
  periodLabel: string;
  totals: Totals;
}

/** Linhas da tabela: uma por pessoa (total) ou por pessoa e período; pessoas sem dias também aparecem no total. */
export function reportLines(people: ReportPerson[], days: ReportDay[], bucket: ReportBucket): ReportLine[] {
  const byKey = new Map<string, ReportLine>();
  const byId = new Map(people.map((p) => [p.id, p]));
  for (const p of people) if (bucket === "total") byKey.set(`${p.id}|total`, { person: p, periodKey: "total", periodLabel: "Total", totals: empty() });
  for (const d of days) {
    const p = byId.get(d.employeeId);
    if (!p) continue;
    const b = bucketKey(d.workDate, bucket);
    const k = `${p.id}|${b.key}`;
    const line = byKey.get(k) ?? { person: p, periodKey: b.key, periodLabel: b.label, totals: empty() };
    add(line.totals, d);
    byKey.set(k, line);
  }
  return [...byKey.values()].sort((a, b) => a.person.name.localeCompare(b.person.name, "pt") || a.periodKey.localeCompare(b.periodKey));
}

export function grandTotals(days: ReportDay[]): Totals {
  const t = empty();
  for (const d of days) add(t, d);
  return t;
}

/** Série da equipa para o gráfico (trabalhado vs. planeado por dia, semana ou mês). */
export function teamSeries(days: ReportDay[], bucket: ReportBucket): StatsBucket[] {
  const b: ReportBucket = bucket === "total" ? (days.length && days.some((d) => d.workDate.slice(0, 7) !== days[0]!.workDate.slice(0, 7)) ? "month" : "week") : bucket;
  const out = new Map<string, StatsBucket>();
  for (const d of days) {
    const k = bucketKey(d.workDate, b);
    const label = b === "week" ? `${k.key.slice(8)}/${k.key.slice(5, 7)}` : MONTHS[Number(k.key.slice(5, 7)) - 1]!;
    const s = out.get(k.key) ?? { key: k.key, label, worked: 0, theoretical: 0, missing: 0, late: 0 };
    s.worked += d.worked;
    s.theoretical += d.planned;
    if (d.missing) s.missing += 1;
    if (d.late) s.late += 1;
    out.set(k.key, s);
  }
  return [...out.values()].sort((a, b2) => a.key.localeCompare(b2.key));
}

/** Horas decimais (Excel) — 2 casas. */
export const hours = (s: number) => Math.round((s / 3600) * 100) / 100;
/** «7h05» para o ecrã e o PDF. */
export const hhmm = (s: number) => {
  const sign = s < 0 ? "-" : "";
  const m = Math.round(Math.abs(s) / 60);
  return `${sign}${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
};

export const EXPORT_COLUMNS = ["Colaborador", "Período", "Horas planeadas", "Horas trabalhadas", "Diferença", "Cumprimento %", "Dias planeados", "Dias trabalhados", "Atrasos", "Minutos de atraso", "Faltas", "Saídas esquecidas", "Dias com ausência/feriado", "Pontualidade %"];

/** Linhas para exportar (números como números, para o Excel somar). */
export function exportRows(lines: ReportLine[], number: (s: number) => number | string = hours): (string | number)[][] {
  return lines.map((l) => {
    const t = l.totals;
    return [l.person.name, l.periodLabel, number(t.planned), number(t.worked), number(t.worked - t.planned), compliance(t) ?? "", t.plannedDays, t.workedDays, t.late, t.lateMinutes, t.missing, t.forgotten, t.excused, punctuality(t) ?? ""];
  });
}
