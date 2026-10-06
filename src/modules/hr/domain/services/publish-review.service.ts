import type { WorkShift } from "../entities/schedule.ts";

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

/** "Terça, 07/10". */
export function reviewDayLabel(workDate: string): string {
  const [y, m, d] = workDate.split("-").map(Number) as [number, number, number];
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "10:00–18:00", "11:00–15:00 · 19:00–23:00", "20:00–00:00 (+1)". */
export function reviewShiftHours(s: Pick<WorkShift, "startTime" | "endTime" | "secondStartTime" | "secondEndTime" | "endsNextDay">): string {
  const first = `${s.startTime.slice(0, 5)}–${s.endTime.slice(0, 5)}`;
  if (s.secondStartTime && s.secondEndTime) return `${first} · ${s.secondStartTime.slice(0, 5)}–${s.secondEndTime.slice(0, 5)}`;
  return s.endsNextDay ? `${first} (+1)` : first;
}

/**
 * "Rever e publicar": só rascunhos, agrupados por dia (por ordem), e dentro
 * de cada dia por colaborador e hora — para o gestor ver o que o
 * colaborador vai passar a ver no Portal antes de publicar.
 */
export function groupDraftsByDay(shifts: WorkShift[]): Array<{ workDate: string; label: string; shifts: WorkShift[] }> {
  const drafts = shifts.filter((s) => s.status === "draft");
  const days = [...new Set(drafts.map((s) => s.workDate))].sort();
  return days.map((workDate) => ({
    workDate,
    label: reviewDayLabel(workDate),
    shifts: drafts
      .filter((s) => s.workDate === workDate)
      .sort((a, b) => a.employeeName.localeCompare(b.employeeName, "pt") || a.startTime.localeCompare(b.startTime)),
  }));
}
