/**
 * Serviço de domínio puro: cálculos de período para os modos de visualização.
 * Sem React, fetch ou DOM — testável com dados simples.
 */

/** Devolve a data da segunda-feira da semana que contém `dateYmd` (YYYY-MM-DD). */
export function getMondayOfWeek(dateYmd: string): string {
  const d = new Date(dateYmd + "T12:00:00Z");
  const day = d.getUTCDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

/**
 * Devolve os 7 dias (YYYY-MM-DD) da semana que começa em `mondayYmd`.
 * Ordem: Segunda → Domingo.
 */
export function getWeekDays(mondayYmd: string): string[] {
  const days: string[] = [];
  const base = new Date(mondayYmd + "T12:00:00Z");
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setUTCDate(base.getUTCDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** Avança uma semana a partir de `mondayYmd`. */
export function nextWeekMonday(mondayYmd: string): string {
  const d = new Date(mondayYmd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

/** Recua uma semana a partir de `mondayYmd`. */
export function prevWeekMonday(mondayYmd: string): string {
  const d = new Date(mondayYmd + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** Devolve `{ from, to }` para todo o mês indicado (1-based month). */
export function getMonthRange(year: number, month: number): { from: string; to: string } {
  const mm = String(month).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${mm}-01`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

/** Avança um mês. */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** Recua um mês. */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  return month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
}

const DAY_NAMES_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
const MONTH_NAMES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
] as const;

export function formatDayLabel(ymd: string): { short: string; num: number; month: string } {
  const d = new Date(ymd + "T12:00:00Z");
  return {
    short: DAY_NAMES_PT[d.getUTCDay()] ?? "",
    num: d.getUTCDate(),
    month: MONTH_NAMES_PT[d.getUTCMonth()] ?? "",
  };
}

export function formatWeekLabel(mondayYmd: string): string {
  const days = getWeekDays(mondayYmd);
  const first = new Date(mondayYmd + "T12:00:00Z");
  const last = new Date((days[6] ?? mondayYmd) + "T12:00:00Z");
  const sameMonth = first.getUTCMonth() === last.getUTCMonth();
  const monthFirst = MONTH_NAMES_PT[first.getUTCMonth()] ?? "";
  const monthLast = MONTH_NAMES_PT[last.getUTCMonth()] ?? "";
  if (sameMonth) {
    return `${first.getUTCDate()}–${last.getUTCDate()} ${monthFirst} ${last.getUTCFullYear()}`;
  }
  return `${first.getUTCDate()} ${monthFirst} – ${last.getUTCDate()} ${monthLast} ${last.getUTCFullYear()}`;
}

export function formatMonthLabel(year: number, month: number): string {
  return `${MONTH_NAMES_PT[(month - 1) % 12] ?? ""} ${year}`;
}
