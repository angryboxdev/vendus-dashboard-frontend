const LISBON_TZ = "Europe/Lisbon";

/** Hoje (ano e mês civil) em Europe/Lisbon. month 1–12. */
export function getCurrentYearMonthLisbon(): { year: number; month: number } {
  const d = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LISBON_TZ,
    year: "numeric",
    month: "numeric",
  }).formatToParts(d);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  return { year: y, month: m };
}

/**
 * Primeiro e último dia civil do mês (YYYY-MM-DD). O número de dias por mês é
 * fixo no calendário gregoriano; alinhado ao uso do produto em Portugal.
 */
export function getCivilMonthRangeIso(
  year: number,
  month1to12: number,
): { from: string; to: string } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month1to12, 0).getDate();
  return {
    from: `${year}-${pad(month1to12)}-01`,
    to: `${year}-${pad(month1to12)}-${pad(lastDay)}`,
  };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/;

export function isValidIsoDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, mo, d] = s.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d
  );
}

/** Valor para `<input type="date" />` a partir de uma data-hora ISO do backend. */
export function isoDatetimeToDateInputValue(
  iso: string | null | undefined,
): string {
  if (!iso?.trim()) return "";
  const t = iso.trim();
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(t);
  if (m) return m[1];
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/** YYYY-MM-DD do date picker → ISO 8601 (meio-dia UTC, estável face ao DST). */
export function dateInputValueToIsoDatetime(yyyyMmDd: string): string | null {
  const s = yyyyMmDd.trim();
  if (!s) return null;
  if (!isValidIsoDate(s)) return null;
  const [y, mo, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0, 0)).toISOString();
}

/** Valor para `<input type="month" />` (YYYY-MM). */
export function formatYearMonth(year: number, month1to12: number): string {
  return `${year}-${String(month1to12).padStart(2, "0")}`;
}

/** Minutos desde meia-noite para HH:mm ou HH:mm:ss */
export function parseTimeToMinutes(t: string): number | null {
  const m = TIME_RE.exec(t.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  return hh * 60 + mm;
}

export function isStartBeforeEndSameDay(startTime: string, endTime: string): boolean {
  const a = parseTimeToMinutes(startTime);
  const b = parseTimeToMinutes(endTime);
  if (a == null || b == null) return false;
  return a < b;
}

export type CalendarCell =
  | { kind: "empty" }
  | { kind: "day"; iso: string; day: number };

/** Segunda-feira como primeiro dia da semana. */
export function buildMonthCalendarCells(
  year: number,
  month1to12: number,
): CalendarCell[][] {
  const monthIndex = month1to12 - 1;
  const first = new Date(year, monthIndex, 1);
  const jsDay = first.getDay();
  const mondayOffset = (jsDay + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const flat: CalendarCell[] = [];
  for (let i = 0; i < mondayOffset; i += 1) {
    flat.push({ kind: "empty" });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${year}-${String(month1to12).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    flat.push({ kind: "day", iso, day: d });
  }
  while (flat.length % 7 !== 0) {
    flat.push({ kind: "empty" });
  }

  const rows: CalendarCell[][] = [];
  for (let i = 0; i < flat.length; i += 7) {
    rows.push(flat.slice(i, i + 7));
  }
  return rows;
}
