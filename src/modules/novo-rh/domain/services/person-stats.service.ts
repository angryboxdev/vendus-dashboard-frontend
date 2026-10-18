import type { AttendanceDays } from "../entities/attendance.ts";
import { dateIn, timeIn } from "./attendance.service.ts";

const avgTime = (minutes: number[]) => {
  if (!minutes.length) return "—";
  const m = Math.round(minutes.reduce((s, x) => s + x, 0) / minutes.length);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const toMin = (hhmm: string) =>
  Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Ficha → Estatísticas: números de um mês a partir do apuramento (a mesma fonte das outras vistas, RE-6). */
export function monthStats(data: AttendanceDays) {
  const days = data.days;
  const firstIns: number[] = [];
  const lastOuts: number[] = [];
  for (const d of days) {
    const evs = data.events
      .filter((e) => dateIn(e.occurredAt, data.timeZone) === d.workDate)
      .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    const firstIn = evs.find(
      (e) => e.segmentType === "work" || e.segmentType === "remote",
    );
    const lastOut = [...evs].reverse().find((e) => e.segmentType === "off");
    if (firstIn)
      firstIns.push(toMin(timeIn(firstIn.occurredAt, data.timeZone)));
    if (lastOut)
      lastOuts.push(toMin(timeIn(lastOut.occurredAt, data.timeZone)));
  }
  const worked = days.filter((d) => d.workedSeconds > 0);
  return {
    worked: days.reduce((s, d) => s + d.workedSeconds, 0),
    theoretical: days.reduce((s, d) => s + d.theoreticalSeconds, 0),
    scheduledDays: days.filter((d) => d.theoreticalSeconds > 0).length,
    workedDays: worked.length,
    missing: days.filter((d) => d.incidents.includes("missing_in")).length,
    late: days.filter((d) => d.incidents.includes("late")).length,
    forgotten: days.filter(
      (d) =>
        d.incidents.includes("missing_out") ||
        d.incidents.includes("auto_closed"),
    ).length,
    avgIn: avgTime(firstIns),
    avgOut: avgTime(lastOuts),
    avgBreak: worked.length
      ? Math.round(
          worked.reduce((s, d) => s + d.breakSeconds, 0) / worked.length,
        )
      : 0,
  };
}

/**
 * Explicações para números que parecem errados (não os corrige — o motor de
 * ponto é a fonte): trabalho sem nenhum previsto no período (sem horário nem
 * turnos publicados) e dias com pausa em curso ou fechada automaticamente
 * (a pausa conta inteira, o que puxa a pausa média para cima).
 */
export function statsNotes(data: AttendanceDays): { noSchedule: boolean; openBreakDays: number } {
  const worked = data.days.some((d) => d.workedSeconds > 0);
  const anyPlanned = data.days.some((d) => d.theoreticalSeconds > 0);
  const openBreakDays = data.days.filter((d) => d.segments.some((s) => (s.type === "break_paid" || s.type === "break_unpaid") && (s.open || s.autoClosed))).length;
  return { noSchedule: worked && !anyPlanned, openBreakDays };
}

/** Campos alterados entre `before` e `after` (só os nomes — os valores ficam na Auditoria). */
export function auditChangedFields(before: unknown, after: unknown): string[] {
  const b = (before && typeof before === "object" ? before : {}) as Record<
    string,
    unknown
  >;
  const a = (after && typeof after === "object" ? after : {}) as Record<
    string,
    unknown
  >;
  const skip = new Set([
    "version",
    "record_version",
    "updatedAt",
    "updated_at",
    "etag",
  ]);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
    (k) => !skip.has(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]),
  );
}

/** Mudanças de um campo ao longo da auditoria (mais recentes primeiro). Aceita camelCase e snake_case. */
export function fieldHistory(events: { id: string; occurredAt: string; actor: string; reason: string | null; before: unknown; after: unknown }[], field: string) {
  const snake = field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  const pick = (o: unknown) => {
    const r = (o && typeof o === "object" ? o : {}) as Record<string, unknown>;
    return field in r ? { has: true, v: r[field] } : snake in r ? { has: true, v: r[snake] } : { has: false, v: undefined };
  };
  return events
    .map((e) => ({ e, b: pick(e.before), a: pick(e.after) }))
    .filter((x) => x.a.has && JSON.stringify(x.a.v) !== JSON.stringify(x.b.v))
    .map((x) => ({ id: x.e.id, at: x.e.occurredAt, actor: x.e.actor, reason: x.e.reason, from: x.b.v, to: x.a.v }))
    .sort((a, b) => b.at.localeCompare(a.at));
}
