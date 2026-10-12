/**
 * Grelha semanal de Escalas (Design System Mezza): regras só de apresentação
 * — tipo/cor de cada turno, horas, cabeçalhos e linhas. Não muda dados nem
 * regras de negócio; as horas são a soma dos períodos menos a pausa, como no
 * resto do RH.
 */
import type { WorkShift } from "../entities/schedule.ts";
import { formatMinutes } from "./shift-template.service.ts";

/** Tipo visual do turno (cor operacional). */
export type ShiftVisualType = "morning" | "afternoon" | "night" | "split" | "other";

export const SHIFT_TYPE_LABELS: Record<ShiftVisualType, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noturno",
  split: "Partido",
  other: "Serviço",
};

type Times = Pick<WorkShift, "startTime" | "endTime" | "endsNextDay" | "secondStartTime" | "secondEndTime">;

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Partido se tem 2.º período; noturno se passa a meia-noite ou começa às 20h ou depois; senão manhã/tarde pela hora de início. */
export function shiftVisualType(s: Times): ShiftVisualType {
  if (s.secondStartTime && s.secondEndTime) return "split";
  const start = toMinutes(s.startTime);
  if (s.endsNextDay || start >= 20 * 60) return "night";
  return start < 12 * 60 ? "morning" : "afternoon";
}

/** Tipo de um modelo: o nome manda quando é um dos nomes conhecidos (ex.: "Serviço"); senão, pelas horas. */
export function templateVisualType(t: Times & { name: string }): ShiftVisualType {
  const n = t.name.trim().toLowerCase();
  if (n.startsWith("serv")) return "other";
  if (n.startsWith("parti") || n.startsWith("repart")) return "split";
  if (n.startsWith("notur") || n.startsWith("noite")) return "night";
  if (n.startsWith("manh")) return "morning";
  if (n.startsWith("tard")) return "afternoon";
  return shiftVisualType(t);
}

function segment(start: string, end: string, nextDay: boolean): number {
  const d = toMinutes(end) - toMinutes(start);
  return nextDay || d <= 0 ? d + 24 * 60 : d;
}

/** Minutos de trabalho: períodos − pausa (nunca negativo). */
export function shiftWorkMinutes(s: Times & { breakMinutes: number }): number {
  let total = segment(s.startTime, s.endTime, s.endsNextDay);
  if (s.secondStartTime && s.secondEndTime) total += segment(s.secondStartTime, s.secondEndTime, false);
  return Math.max(0, total - (s.breakMinutes ?? 0));
}

/** "6h", "8h 30min", "0h". */
export function hoursLabel(minutes: number): string {
  return minutes <= 0 ? "0h" : formatMinutes(minutes);
}

/** "09:00 - 15:00" (com hífen, como na grelha). */
export function timeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

/** Abreviatura do chip do modelo ("Man", "Not", "Par"…). */
export function abbreviation(name: string): string {
  const clean = name.trim();
  return clean ? clean.slice(0, 3).charAt(0).toUpperCase() + clean.slice(1, 3).toLowerCase() : "?";
}

const WEEKDAYS = ["Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado", "Domingo"];

/** Cabeçalho da coluna: "Segunda-feira" + dia do mês. */
export function dayHeader(d: Date): { weekday: string; day: number } {
  return { weekday: WEEKDAYS[(d.getDay() + 6) % 7]!, day: d.getDate() };
}

/** "12/10/2026 - 18/10/2026". */
export function weekRangeLabel(first: Date, last: Date): string {
  const f = (d: Date) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  return `${f(first)} - ${f(last)}`;
}

export interface BoardEmployee {
  id: string;
  fullName: string;
  positionId: string | null;
  primaryLocationId: string | null;
  photoUrl: string | null;
}

export interface BoardRow {
  employee: BoardEmployee;
  minutes: number;
  shiftsByDate: Map<string, WorkShift[]>;
}

/**
 * Linhas da grelha: quem tem turnos na semana ("atribuídas") e, se pedido,
 * também quem não tem ("ocultos"). Filtra pela pesquisa (nome) e ordena por
 * nome.
 */
export function boardRows(
  employees: BoardEmployee[],
  shifts: WorkShift[],
  options: { search: string; showUnassigned: boolean; sort: "asc" | "desc"; locationId: string },
): { rows: BoardRow[]; assigned: number; hidden: number } {
  const byEmployee = new Map<string, WorkShift[]>();
  for (const s of shifts) byEmployee.set(s.employeeId, [...(byEmployee.get(s.employeeId) ?? []), s]);
  const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const q = norm(options.search.trim());
  const pool = employees.filter((e) => !options.locationId || e.primaryLocationId === options.locationId || byEmployee.has(e.id));
  // Quem tem turnos mas não está na lista de ativos (ex.: entretanto desativado) aparece na mesma.
  for (const s of shifts) if (!pool.some((e) => e.id === s.employeeId)) pool.push({ id: s.employeeId, fullName: s.employeeName, positionId: null, primaryLocationId: null, photoUrl: null });
  const assigned = pool.filter((e) => byEmployee.has(e.id));
  const hidden = pool.length - assigned.length;
  const visible = (options.showUnassigned ? pool : assigned).filter((e) => !q || norm(e.fullName).includes(q));
  const rows = visible
    .map((employee) => {
      const own = byEmployee.get(employee.id) ?? [];
      const shiftsByDate = new Map<string, WorkShift[]>();
      for (const s of own) shiftsByDate.set(s.workDate, [...(shiftsByDate.get(s.workDate) ?? []), s].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      return { employee, minutes: own.reduce((sum, s) => sum + shiftWorkMinutes(s), 0), shiftsByDate };
    })
    .sort((a, b) => a.employee.fullName.localeCompare(b.employee.fullName, "pt") * (options.sort === "asc" ? 1 : -1));
  return { rows, assigned: assigned.length, hidden };
}

/** Contagens do cabeçalho de cada dia: pessoas escaladas e turnos. */
export function dayCounts(shifts: WorkShift[], ymd: string): { people: number; shifts: number } {
  const day = shifts.filter((s) => s.workDate === ymd);
  return { people: new Set(day.map((s) => s.employeeId)).size, shifts: day.length };
}

/** Agrupamento "Turnos": uma linha por tipo/nome de turno, com as pessoas de cada dia. */
export function shiftTypeRows(shifts: WorkShift[], labelOf: (s: WorkShift) => string): { label: string; byDate: Map<string, WorkShift[]> }[] {
  const map = new Map<string, Map<string, WorkShift[]>>();
  for (const s of shifts) {
    const label = labelOf(s);
    const byDate = map.get(label) ?? new Map<string, WorkShift[]>();
    byDate.set(s.workDate, [...(byDate.get(s.workDate) ?? []), s]);
    map.set(label, byDate);
  }
  return [...map.entries()].map(([label, byDate]) => ({ label, byDate })).sort((a, b) => a.label.localeCompare(b.label, "pt"));
}
