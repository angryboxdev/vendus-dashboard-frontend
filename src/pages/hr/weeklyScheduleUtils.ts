import { parseTimeToMinutes } from "./dates";
import type { CreateShiftBody } from "./hrApi";
import type { HrWorkShift, WeeklySchedule } from "./hr.types";

/** Valor estável para `<input type="time" />` (HH:mm). */
export function toTimeInputValue(s: string): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)/.exec(s.trim());
  return m ? `${m[1]}:${m[2]}` : "";
}

export const WEEKDAY_MON_FIRST_LABELS = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
] as const;

/** `(getDay() + 6) % 7` — segunda = 0 … domingo = 6. */
export function mondayFirstWeekdayFromParts(
  year: number,
  month1to12: number,
  day: number,
): number {
  const dt = new Date(year, month1to12 - 1, day);
  return (dt.getDay() + 6) % 7;
}

function normalizeTimeSegment(t: string): string {
  const m = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(t.trim());
  if (!m) return t.trim();
  if (m[3] != null && m[3] !== "00") {
    return `${m[1]}:${m[2]}:${m[3]}`;
  }
  return `${m[1]}:${m[2]}`;
}

/** Ordena dias por `weekday` e segmentos por `startTime` (substituição completa no PATCH). */
export function finalizeWeeklySchedule(ws: WeeklySchedule): WeeklySchedule {
  const days = [...ws.days]
    .filter((d) => d.segments.length > 0)
    .map((d) => ({
      weekday: d.weekday,
      segments: [...d.segments]
        .map((s) => ({
          startTime: normalizeTimeSegment(s.startTime),
          endTime: normalizeTimeSegment(s.endTime),
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    }))
    .sort((a, b) => a.weekday - b.weekday);
  return { days };
}

function shiftDedupeKey(workDate: string, startTime: string, endTime: string): string {
  const a = parseTimeToMinutes(startTime);
  const b = parseTimeToMinutes(endTime);
  return `${workDate}|${a ?? startTime}|${b ?? endTime}`;
}

/** Gera corpos `CreateShiftBody` para cada dia civil do mês que coincide com a escala; ignora duplicados já existentes. */
export function buildCreateShiftBodiesFromWeeklySchedule(
  employeeId: string,
  schedule: WeeklySchedule,
  year: number,
  month1to12: number,
  existingInMonth: HrWorkShift[],
): CreateShiftBody[] {
  const byWeekday = new Map<
    number,
    { startTime: string; endTime: string }[]
  >();
  for (const d of schedule.days) {
    if (d.segments.length > 0) {
      byWeekday.set(d.weekday, d.segments);
    }
  }

  const existingKeys = new Set(
    existingInMonth.map((s) =>
      shiftDedupeKey(s.workDate, s.startTime, s.endTime),
    ),
  );

  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month1to12, 0).getDate();
  const out: CreateShiftBody[] = [];

  for (let day = 1; day <= lastDay; day += 1) {
    const iso = `${year}-${pad(month1to12)}-${pad(day)}`;
    const wd = mondayFirstWeekdayFromParts(year, month1to12, day);
    const segments = byWeekday.get(wd);
    if (!segments?.length) continue;

    for (const seg of segments) {
      const key = shiftDedupeKey(iso, seg.startTime, seg.endTime);
      if (existingKeys.has(key)) continue;
      existingKeys.add(key);
      out.push({
        employeeId,
        workDate: iso,
        startTime: normalizeTimeSegment(seg.startTime),
        endTime: normalizeTimeSegment(seg.endTime),
      });
    }
  }

  return out;
}
