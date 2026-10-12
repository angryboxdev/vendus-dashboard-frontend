import type { ScheduleKind, ScheduleVersion, TimeRange, Weekday } from "../entities/time.ts";

export const WEEKDAYS: Weekday[] = ["1", "2", "3", "4", "5", "6", "7"];

/** "08h30" a partir de minutos. */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}h${String(m).padStart(2, "0")}`;
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutos planeados num dia (igual ao backend: faixa que termina antes do início só em horário noturno). */
export function dayMinutes(kind: ScheduleKind, v: Pick<ScheduleVersion, "days" | "night">, d: Weekday): number {
  const value = v.days[d];
  if (kind === "flexible") return typeof value === "number" ? value : 0;
  return ((value as TimeRange[] | undefined) ?? []).reduce((s, r) => {
    const a = toMin(r.start);
    const b = toMin(r.end);
    return s + (b > a ? b - a : v.night ? 1440 - a + b : 0);
  }, 0);
}

export const weeklyMinutes = (kind: ScheduleKind, v: Pick<ScheduleVersion, "days" | "night">) => WEEKDAYS.reduce((s, d) => s + dayMinutes(kind, v, d), 0);

/** Editor simples: texto "09:00-13:00, 14:00-18:00" (fixo) ou "8" horas (flexível) por dia. */
export type DayDraft = Record<Weekday, string>;

export function versionDaysFromDraft(kind: ScheduleKind, draft: DayDraft): ScheduleVersion["days"] | null {
  const days: ScheduleVersion["days"] = {};
  for (const d of WEEKDAYS) {
    const raw = draft[d].trim();
    if (!raw) continue;
    if (kind === "flexible") {
      const hours = Number(raw.replace(",", "."));
      if (!Number.isFinite(hours) || hours < 0 || hours > 24) return null;
      days[d] = Math.round(hours * 60);
      continue;
    }
    const ranges: TimeRange[] = [];
    for (const part of raw.split(",")) {
      const m = part.trim().match(/^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/);
      if (!m) return null;
      ranges.push({ start: `${m[1]}:${m[2]}`, end: `${m[3]}:${m[4]}` });
    }
    days[d] = ranges;
  }
  return days;
}

export const emptyDraft = (): DayDraft => ({ "1": "", "2": "", "3": "", "4": "", "5": "", "6": "", "7": "" });
