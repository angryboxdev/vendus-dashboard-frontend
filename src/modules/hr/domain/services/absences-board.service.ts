import { ABSENCE_STATUS_STYLE, ABSENCE_TYPE_LABEL, type AbsenceRecord, type AbsenceType } from "../entities/absences.ts";

export type RecordsTab = "all" | "pending" | "approved" | "closed";

export interface BoardFilters {
  search: string;
  type: AbsenceType | "";
  locationId: string;
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function filterRecords(records: AbsenceRecord[], f: BoardFilters): AbsenceRecord[] {
  const q = norm(f.search.trim());
  return records.filter((r) => (!q || norm(r.employeeName).includes(q)) && (!f.type || r.type === f.type) && (!f.locationId || r.locationId === f.locationId));
}

export function inTab(r: AbsenceRecord, tab: RecordsTab): boolean {
  if (tab === "all") return true;
  if (tab === "pending") return r.status === "pending";
  if (tab === "approved") return r.status === "approved";
  return r.status === "rejected" || r.status === "cancelled";
}

export function tabCounts(records: AbsenceRecord[]): Record<RecordsTab, number> {
  return {
    all: records.length,
    pending: records.filter((r) => inTab(r, "pending")).length,
    approved: records.filter((r) => inTab(r, "approved")).length,
    closed: records.filter((r) => inTab(r, "closed")).length,
  };
}

/** Primeiro e último dia do mês (`YYYY-MM`). */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function monthLabel(month: string): string {
  return `${MONTHS[Number(month.slice(5, 7)) - 1]} de ${month.slice(0, 4)}`;
}

/** 42 dias (6 semanas, segunda a domingo) da grelha do mês. */
export function calendarDays(month: string): string[] {
  const first = new Date(`${month}-01T12:00:00Z`);
  const offset = (first.getUTCDay() + 6) % 7;
  const start = new Date(first);
  start.setUTCDate(first.getUTCDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Registos que tocam o dia (não cancelados/rejeitados — o calendário mostra disponibilidade). */
export function recordsOnDay(records: AbsenceRecord[], ymd: string): AbsenceRecord[] {
  return records.filter((r) => r.startDate <= ymd && ymd <= r.endDate && (r.status === "approved" || r.status === "pending"));
}

/** "Carlos Andrés" — primeiro + segundo nome, como no mockup. */
export function calendarName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  return parts.slice(0, 2).map(cap).join(" ");
}

export const fmtDate = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;

/** CSV (separador ";" — abre bem no Excel PT). */
export function recordsCsv(records: AbsenceRecord[]): string {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const rows = [["Colaborador", "Cargo", "Local", "Início", "Fim", "Tipo", "Duração", "Estado", "Turnos afetados", "Observação"]];
  for (const r of records) {
    rows.push([r.employeeName, r.positionName ?? "", r.locationName ?? "", fmtDate(r.startDate), fmtDate(r.endDate), ABSENCE_TYPE_LABEL[r.type], r.duration, ABSENCE_STATUS_STYLE[r.status].label, String(r.affectedShifts), r.notes ?? ""]);
  }
  return rows.map((row) => row.map(esc).join(";")).join("\n");
}
