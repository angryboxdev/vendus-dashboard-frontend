/**
 * Grelha da escala (Design System Mezza): regras só de apresentação — tipo e
 * cor de cada turno, horas, cabeçalhos dos dias e linhas. Não muda dados nem
 * regras (avisos e bloqueios continuam a vir da API).
 */
import type {
  RosterShift,
  Segment,
  ShiftTemplate,
} from "../entities/rosters.ts";

/** Tipo visual do turno (pastel operacional). */
export type RosterTone = "morning" | "afternoon" | "night" | "split" | "other";

export const TONE_LABEL: Record<RosterTone, string> = {
  morning: "Manhã",
  afternoon: "Tarde",
  night: "Noturno",
  split: "Partido",
  other: "Serviço",
};

const min = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Pelas faixas: 2+ faixas = partido; passa a meia-noite ou começa às 20h = noturno; senão manhã/tarde. */
export function segmentsTone(segments: Segment[]): RosterTone {
  if (segments.length > 1) return "split";
  const s = segments[0];
  if (!s) return "other";
  if (min(s.end) <= min(s.start) || min(s.start) >= 20 * 60) return "night";
  return min(s.start) < 12 * 60 ? "morning" : "afternoon";
}

/** Tipo de um modelo: o nome manda quando é conhecido (ex.: "Serviço"); senão, pelas faixas. */
export function templateTone(
  t: Pick<ShiftTemplate, "name" | "segments">,
): RosterTone {
  const n = t.name.trim().toLowerCase();
  if (n.startsWith("serv")) return "other";
  if (n.startsWith("parti") || n.startsWith("repart")) return "split";
  if (n.startsWith("notur") || n.startsWith("noite")) return "night";
  if (n.startsWith("manh")) return "morning";
  if (n.startsWith("tard")) return "afternoon";
  return segmentsTone(t.segments);
}

/** Minutos de uma faixa (atravessa a meia-noite se o fim for antes do início). */
export function segmentMinutes(s: Segment): number {
  const d = min(s.end) - min(s.start);
  return d <= 0 ? d + 24 * 60 : d;
}

export const segmentsMinutes = (segments: Segment[]) =>
  segments.reduce((sum, s) => sum + segmentMinutes(s), 0);

/** "6h", "8h 30min", "0h". */
export function hoursLabel(minutes: number): string {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}min`;
  return m ? `${h}h ${String(m).padStart(2, "0")}min` : `${h}h`;
}

/** Total com minutos sempre: "60h 00min", "8h 30min". */
export function hoursLong(minutes: number): string {
  const m = Math.max(0, minutes);
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}min`;
}

/** "09:00 - 15:00". */
export const segmentLabel = (s: Segment) => `${s.start} - ${s.end}`;

/** Faixas efetivas de um turno: as próprias ou as do modelo. */
export function shiftSegments(
  s: Pick<RosterShift, "segments" | "templateId">,
  templates: ShiftTemplate[],
): Segment[] {
  if (s.segments.length) return s.segments;
  return templates.find((t) => t.id === s.templateId)?.segments ?? [];
}

/** Nome e tipo mostrados no cartão: o modelo quando existe; senão pelo horário. */
export function shiftDisplay(
  s: Pick<RosterShift, "segments" | "templateId" | "kind">,
  templates: ShiftTemplate[],
): { title: string; tone: RosterTone } {
  const t = templates.find((x) => x.id === s.templateId);
  if (t) return { title: t.name, tone: templateTone(t) };
  const tone = segmentsTone(shiftSegments(s, templates));
  return { title: TONE_LABEL[tone], tone };
}

const WEEKDAYS = [
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
  "Domingo",
];

/** "2026-10-12" → { weekday: "Segunda-feira", day: 12 } (datas sem fuso). */
export function dayHeader(ymd: string): { weekday: string; day: number } {
  const d = new Date(`${ymd}T00:00:00Z`);
  return { weekday: WEEKDAYS[(d.getUTCDay() + 6) % 7]!, day: d.getUTCDate() };
}

/** "12/10/2026 - 18/10/2026". */
export function rangeLabel(from: string, to: string): string {
  const f = (d: string) =>
    `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  return `${f(from)} - ${f(to)}`;
}

/** Abreviatura do chip: a do modelo; sem ela, as 3 primeiras letras do nome. */
export function chipLabel(
  t: Pick<ShiftTemplate, "abbreviation" | "name">,
): string {
  const a = t.abbreviation?.trim();
  if (a) return a;
  const n = t.name.trim();
  return n ? n.charAt(0).toUpperCase() + n.slice(1, 3).toLowerCase() : "?";
}

export interface RosterRow {
  employeeId: string;
  name: string;
  positionId: string | null;
  photoUrl: string | null;
  minutes: number;
  byDate: Map<string, RosterShift[]>;
}

/**
 * Linhas da grelha: quem tem turnos na semana, mais as pessoas acrescentadas
 * à mão; pesquisa sem acentos e ordem por nome.
 */
export function rosterRows(
  shifts: RosterShift[],
  extra: string[],
  people: {
    id: string;
    label: string;
    positionId?: string | null;
    photoUrl?: string | null;
  }[],
  templates: ShiftTemplate[],
  options: { search: string; sort: "asc" | "desc" },
): RosterRow[] {
  const live = shifts.filter((s) => !s.deleted);
  const ids = [...new Set([...live.map((s) => s.employeeId), ...extra])];
  const norm = (v: string) =>
    v
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase();
  const q = norm(options.search.trim());
  return ids
    .map((id) => {
      const person = people.find((p) => p.id === id);
      const own = live.filter((s) => s.employeeId === id);
      const byDate = new Map<string, RosterShift[]>();
      for (const s of own)
        byDate.set(s.workDate, [...(byDate.get(s.workDate) ?? []), s]);
      const minutes = own
        .filter((s) => s.kind === "shift")
        .reduce(
          (sum, s) => sum + segmentsMinutes(shiftSegments(s, templates)),
          0,
        );
      return {
        employeeId: id,
        name: person?.label ?? id,
        positionId: person?.positionId ?? null,
        photoUrl: person?.photoUrl ?? null,
        minutes,
        byDate,
      };
    })
    .filter((r) => !q || norm(r.name).includes(q))
    .sort(
      (a, b) =>
        a.name.localeCompare(b.name, "pt") * (options.sort === "asc" ? 1 : -1),
    );
}

/** Pessoas escaladas e turnos de um dia (para o cabeçalho). */
export function dayCounts(
  shifts: RosterShift[],
  ymd: string,
): { people: number; shifts: number } {
  const day = shifts.filter(
    (s) => !s.deleted && s.workDate === ymd && s.kind === "shift",
  );
  return {
    people: new Set(day.map((s) => s.employeeId)).size,
    shifts: day.length,
  };
}

export interface ShiftRow {
  /** Id do modelo, "day_off" ou "custom:<nome>" (turnos sem modelo). */
  key: string;
  label: string;
  tone: RosterTone | "neutral";
  chip: string;
  /** Faixas do modelo (vazio nas folgas). */
  segments: Segment[];
  /** Horas de todos os turnos desta linha no período. */
  minutes: number;
  byDate: Map<string, RosterShift[]>;
}

const shiftKey = (s: RosterShift, templates: ShiftTemplate[]) =>
  s.kind === "day_off"
    ? "day_off"
    : (s.templateId ?? `custom:${shiftDisplay(s, templates).title}`);

/**
 * Vista por turnos: uma linha por modelo usado no período (e uma para as
 * folgas, no fim), com quem o faz em cada dia e as horas somadas.
 */
export function shiftRows(
  shifts: RosterShift[],
  templates: ShiftTemplate[],
): ShiftRow[] {
  const rows = new Map<string, ShiftRow>();
  for (const s of shifts.filter((x) => !x.deleted)) {
    const key = shiftKey(s, templates);
    let row = rows.get(key);
    if (!row) {
      const tpl = templates.find((t) => t.id === key);
      const shown = shiftDisplay(s, templates);
      row = {
        key,
        label: key === "day_off" ? "Folga" : shown.title,
        tone: key === "day_off" ? "neutral" : shown.tone,
        chip:
          key === "day_off"
            ? "F"
            : tpl
              ? chipLabel(tpl)
              : shown.title.slice(0, 3),
        segments: key === "day_off" ? [] : shiftSegments(s, templates),
        minutes: 0,
        byDate: new Map(),
      };
      rows.set(key, row);
    }
    if (s.kind === "shift")
      row.minutes += segmentsMinutes(shiftSegments(s, templates));
    row.byDate.set(s.workDate, [...(row.byDate.get(s.workDate) ?? []), s]);
  }
  return [...rows.values()].sort((a, b) =>
    a.key === "day_off"
      ? 1
      : b.key === "day_off"
        ? -1
        : (a.segments[0]?.start ?? "").localeCompare(
            b.segments[0]?.start ?? "",
          ) || a.label.localeCompare(b.label, "pt"),
  );
}
