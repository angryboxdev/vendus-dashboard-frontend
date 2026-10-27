import type { RosterShift, Segment, ShiftTemplate, Violation } from "../entities/rosters.ts";

/** "16:00-22:00, 22:00-04:00" → faixas; null se o formato não for válido. */
export function parseSegments(text: string): Segment[] | null {
  const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  const out: Segment[] = [];
  for (const p of parts) {
    const m = /^([01]\d|2[0-3]):([0-5]\d)\s*-\s*([01]\d|2[0-3]):([0-5]\d)$/.exec(p);
    if (!m) return null;
    const seg = { start: `${m[1]}:${m[2]}`, end: `${m[3]}:${m[4]}` };
    if (seg.start === seg.end) return null;
    out.push(seg);
  }
  return out;
}

export const formatSegments = (segments: Segment[]) => segments.map((s) => `${s.start}–${s.end}`).join(", ");

/** Datas (AAAA-MM-DD) de `from` durante `days` dias. */
export function daysFrom(from: string, days: number): string[] {
  const out: string[] = [];
  const d = new Date(`${from}T00:00:00Z`);
  for (let i = 0; i < days; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/** `date` (AAAA-MM-DD) mais `n` dias; `n` pode ser negativo (semana anterior). */
export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Rótulo curto de um turno na grelha: abreviatura do modelo ou as horas; folga = "F". */
export function cellLabel(s: Pick<RosterShift, "kind" | "segments" | "templateId">, templates: ShiftTemplate[]): string {
  if (s.kind === "day_off") return "F";
  const t = s.templateId ? templates.find((x) => x.id === s.templateId) : undefined;
  return t ? t.abbreviation : formatSegments(s.segments);
}

/** Violações vindas de um erro da API (409 por confirmar / 422 bloqueio). */
export function violationsOf(error: unknown): { kind: "confirm" | "blocked"; violations: Violation[] } | null {
  const e = error as { status?: number; data?: { violations?: Violation[] } } | null;
  if (!e?.data?.violations?.length) return null;
  if (e.status === 409) return { kind: "confirm", violations: e.data.violations };
  if (e.status === 422) return { kind: "blocked", violations: e.data.violations };
  return null;
}
