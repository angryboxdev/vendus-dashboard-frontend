import type { AttendanceDays, ChangeInput, ClockEvent, ClockRevision, Incident, SegmentType } from "../entities/attendance.ts";
import { dateIn, zonedToUtc } from "./attendance.service.ts";

const ENTRY: SegmentType[] = ["work", "remote"];

export interface EffectiveEvent {
  id: string;
  occurredAt: string;
  segmentType: SegmentType;
}

/** Marcações em vigor: revisões ativas, por ordem de criação, sobre as originais (igual ao backend). */
export function effectiveEvents(events: ClockEvent[], revisions: ClockRevision[]): EffectiveEvent[] {
  const active = revisions.filter((r) => r.state === "active").sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const byId = new Map<string, EffectiveEvent>(events.map((e) => [e.id, { id: e.id, occurredAt: e.occurredAt, segmentType: e.segmentType }]));
  for (const r of active) {
    if (r.operation === "add" && r.occurredAt && r.segmentType) byId.set(`rev:${r.id}`, { id: `rev:${r.id}`, occurredAt: r.occurredAt, segmentType: r.segmentType });
    else if (r.operation === "void" && r.targetEventId) byId.delete(r.targetEventId);
    else if (r.operation === "update" && r.targetEventId && byId.has(r.targetEventId)) {
      const cur = byId.get(r.targetEventId)!;
      byId.set(r.targetEventId, { ...cur, occurredAt: r.occurredAt ?? cur.occurredAt, segmentType: r.segmentType ?? cur.segmentType });
    }
  }
  return [...byId.values()].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}

const nextDate = (date: string) => new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/**
 * Ações rápidas de um dia com atraso ou falta, na conferência da gestão:
 * «Cumpriu horário» (corrige as marcações para o previsto), confirmar o
 * atraso/a falta ou justificar o atraso (fecha o incidente, a hora real fica).
 */
export interface DayQuickActions {
  kind: "late" | "absent";
  plannedAt: string;
  plannedEndAt: string | null;
  /** Entrada em vigor (só no atraso). */
  entryAt: string | null;
  lateMinutes: number;
  /** Correções de «Cumpriu horário» (sem motivo); null = não dá para corrigir sem ambiguidade. */
  fulfilled: Omit<ChangeInput, "reason">[] | null;
  /** Incidente do dia (aberto → confirmar/justificar; resolvido → mostra o desfecho; null = ainda não aberto). */
  incident: Incident | null;
}

export function dayQuickActions(data: AttendanceDays, date: string, now: string): DayQuickActions | null {
  const day = data.days.find((d) => d.workDate === date);
  if (!day?.plannedStart) return null;
  const tz = data.timeZone;
  const plannedAt = zonedToUtc(`${date}T${day.plannedStart}`, tz);
  const plannedEndAt = day.plannedEnd ? zonedToUtc(`${day.plannedEnd <= day.plannedStart ? nextDate(date) : date}T${day.plannedEnd}`, tz) : null;
  const all = effectiveEvents(data.events, data.revisions);
  const entry = all.find((e) => dateIn(e.occurredAt, tz) === date && ENTRY.includes(e.segmentType)) ?? null;
  const incidentOf = (type: Incident["type"]) => data.incidents.find((i) => i.employeeId === data.employeeId && i.workDate === date && i.type === type) ?? null;

  if (entry && (day.incidents.includes("late") || incidentOf("late"))) {
    const lateMinutes = Math.max(0, Math.floor((Date.parse(entry.occurredAt) - Date.parse(plannedAt)) / 60_000));
    const i = all.indexOf(entry);
    const prev = all[i - 1];
    // Só se a entrada recuar sem passar por cima da marcação anterior (a ordem do dia mantém-se).
    const fits = entry.occurredAt > plannedAt && plannedAt <= now && (!prev || prev.occurredAt < plannedAt);
    return {
      kind: "late",
      plannedAt,
      plannedEndAt,
      entryAt: entry.occurredAt,
      lateMinutes,
      fulfilled: fits ? [{ operation: "update", targetEventId: entry.id, occurredAt: plannedAt, segmentType: null }] : null,
      incident: incidentOf("late"),
    };
  }

  if (!entry && (day.incidents.includes("missing_in") || incidentOf("missing_in"))) {
    // Sem nenhuma marcação dentro do turno previsto → acrescenta entrada (e saída, se o turno já acabou).
    const end = plannedEndAt ?? plannedAt;
    const clash = all.some((e) => e.occurredAt >= plannedAt && e.occurredAt <= end);
    const changes: Omit<ChangeInput, "reason">[] = [{ operation: "add", targetEventId: null, occurredAt: plannedAt, segmentType: "work" }];
    if (plannedEndAt && plannedEndAt <= now) changes.push({ operation: "add", targetEventId: null, occurredAt: plannedEndAt, segmentType: "off" });
    return {
      kind: "absent",
      plannedAt,
      plannedEndAt,
      entryAt: null,
      lateMinutes: 0,
      fulfilled: !clash && plannedAt <= now ? changes : null,
      incident: incidentOf("missing_in"),
    };
  }
  return null;
}
