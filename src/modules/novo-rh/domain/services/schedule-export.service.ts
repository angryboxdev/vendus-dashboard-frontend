import type { RosterShift, Segment, ShiftTemplate } from "../entities/rosters.ts";
import { chipLabel, shiftSegments, templateTone, segmentsTone, TONE_COLOR, TONE_LABEL } from "./roster-board.service.ts";

/**
 * Exportação da escala (PDF): um único gerador de dados para as quatro formas
 * de organizar (colaborador, turno, área, cargo) e as duas apresentações
 * (horários completos ou siglas + legenda). Cada atribuição real aparece uma
 * única vez; agrupar só reparte, nunca duplica nem inventa turnos. Sem horas
 * nem totais — só o que cada pessoa faz em cada dia.
 */
export type ExportGroupBy = "employee" | "shift" | "area" | "position";
export type ExportPresentation = "full" | "codes";

/** Filtros (vazio/ausente = todos). "none" = sem área / sem cargo; "custom" = turno sem modelo; "day_off" = folga. */
export interface ExportFilters {
  employeeIds?: string[];
  areaIds?: string[];
  templateIds?: string[];
  positionIds?: string[];
}

export interface ExportCell {
  kind: "shift" | "day_off";
  /** Sigla real do modelo (ou «F» para folga, «P1»… para horários sem modelo). */
  code: string;
  name: string;
  /** «18:00–00:45 (+1 dia)»; vários troços separados por « · ». Vazio na folga. */
  time: string;
  nextDay: boolean;
  area: string | null;
  /** Cor do tipo de turno (hex); null na folga. */
  color: string | null;
  draft: boolean;
}

export interface ExportRow {
  employeeId: string;
  name: string;
  position: string | null;
  /** Uma lista por dia (pela ordem de `days`); vazia = sem turno atribuído («—»). */
  days: ExportCell[][];
}

export interface ExportGroup {
  key: string;
  /** null quando não há agrupamento (organizar por colaborador). */
  title: string | null;
  rows: ExportRow[];
}

export interface ExportLegendItem {
  code: string;
  name: string;
  time: string;
  color: string | null;
}

export interface ScheduleExport {
  days: string[];
  groupBy: ExportGroupBy;
  groups: ExportGroup[];
  legend: ExportLegendItem[];
  /** Exatamente um colaborador: versão individual (A4 vertical). */
  individual: boolean;
  /** Há atribuições ainda não publicadas no que se exporta. */
  hasDraft: boolean;
  /** Atribuições incluídas (cada uma conta uma vez). */
  assignments: number;
}

export interface ExportPerson {
  employeeId: string;
  name: string;
  positionId: string | null;
}

const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const crosses = (s: Segment) => toMin(s.end) <= toMin(s.start);
/** «08:00–16:00», «18:00–00:45 (+1 dia)»; vários troços com « · ». */
export function segmentsText(segments: Segment[]): string {
  return segments.map((s) => `${s.start}–${s.end}${crosses(s) ? " (+1 dia)" : ""}`).join(" · ");
}

const isDraft = (s: RosterShift) => s.dirty || s.published === null;

export function buildScheduleExport(input: {
  days: string[];
  /** Pela ordem da vista (ordenação e pesquisa já aplicadas). */
  people: ExportPerson[];
  shifts: RosterShift[];
  templates: ShiftTemplate[];
  areas: { id: string; name: string; sortOrder: number }[];
  positions: { id: string; name: string }[];
  groupBy: ExportGroupBy;
  filters?: ExportFilters;
}): ScheduleExport {
  const f = input.filters ?? {};
  const has = (list: string[] | undefined, v: string) => !list?.length || list.includes(v);
  const areaName = new Map(input.areas.map((a) => [a.id, a.name]));
  const positionName = new Map(input.positions.map((p) => [p.id, p.name]));
  const people = input.people.filter((p) => has(f.employeeIds, p.employeeId) && has(f.positionIds, p.positionId ?? "none"));
  const personIds = new Set(people.map((p) => p.employeeId));
  const dayIndex = new Map(input.days.map((d, i) => [d, i]));

  // Horários sem modelo: uma sigla por horário distinto (P1, P2…), estável pela ordem de início.
  const custom = new Map<string, string>();
  const customKey = (segs: Segment[]) => segs.map((s) => `${s.start}-${s.end}`).join(",");
  const live = input.shifts
    .filter((s) => !s.deleted && personIds.has(s.employeeId) && dayIndex.has(s.workDate))
    .filter((s) => {
      const templateKey = s.kind === "day_off" ? "day_off" : (s.templateId ?? "custom");
      const areaKey = s.kind === "day_off" ? null : (s.areaId ?? "none");
      // Com filtro de área, as folgas (sem área) ficam de fora.
      return has(f.templateIds, templateKey) && (!f.areaIds?.length || (areaKey !== null && f.areaIds.includes(areaKey)));
    })
    .sort((a, b) => a.workDate.localeCompare(b.workDate) || (shiftSegments(a, input.templates)[0]?.start ?? "").localeCompare(shiftSegments(b, input.templates)[0]?.start ?? ""));
  for (const s of live)
    if (s.kind === "shift" && !input.templates.some((t) => t.id === s.templateId)) {
      const k = customKey(shiftSegments(s, input.templates));
      if (!custom.has(k)) custom.set(k, `P${custom.size + 1}`);
    }

  const cellOf = (s: RosterShift): ExportCell => {
    if (s.kind === "day_off") return { kind: "day_off", code: "F", name: "Folga", time: "", nextDay: false, area: null, color: null, draft: isDraft(s) };
    const segs = shiftSegments(s, input.templates);
    const t = input.templates.find((x) => x.id === s.templateId);
    const tone = t ? templateTone(t) : segmentsTone(segs);
    return {
      kind: "shift",
      code: t ? chipLabel(t) : (custom.get(customKey(segs)) ?? "P"),
      name: t ? t.name : `Horário ${TONE_LABEL[tone].toLowerCase()}`,
      time: segmentsText(segs),
      nextDay: segs.some(crosses),
      area: s.areaId ? (areaName.get(s.areaId) ?? null) : null,
      color: TONE_COLOR[tone],
      draft: isDraft(s),
    };
  };

  // Grupo de cada atribuição (uma só vez).
  const groupOf = (s: RosterShift, p: ExportPerson): { key: string; title: string; order: string } => {
    switch (input.groupBy) {
      case "shift": {
        if (s.kind === "day_off") return { key: "day_off", title: "Folga", order: "9" };
        const t = input.templates.find((x) => x.id === s.templateId);
        if (!t) return { key: "custom", title: "Horários sem modelo", order: "8" };
        return { key: t.id, title: `${t.name} (${chipLabel(t)}) · ${segmentsText(t.segments)}`, order: `1${t.segments[0]?.start ?? ""}${t.name}` };
      }
      case "area": {
        if (s.kind === "day_off") return { key: "day_off", title: "Folga", order: "9" };
        const a = s.areaId ? input.areas.find((x) => x.id === s.areaId) : undefined;
        return a ? { key: a.id, title: a.name, order: `1${String(a.sortOrder).padStart(4, "0")}${a.name}` } : { key: "none", title: "Sem área", order: "8" };
      }
      case "position": {
        const name = p.positionId ? positionName.get(p.positionId) : undefined;
        return name ? { key: p.positionId!, title: name, order: `1${name}` } : { key: "none", title: "Sem cargo", order: "8" };
      }
      default:
        return { key: "all", title: "", order: "1" };
    }
  };

  const byPerson = new Map(people.map((p) => [p.employeeId, p]));
  const groups = new Map<string, { title: string; order: string; rows: Map<string, ExportRow> }>();
  for (const s of live) {
    const p = byPerson.get(s.employeeId)!;
    const g = groupOf(s, p);
    const group = groups.get(g.key) ?? { title: g.title, order: g.order, rows: new Map<string, ExportRow>() };
    groups.set(g.key, group);
    const row = group.rows.get(p.employeeId) ?? { employeeId: p.employeeId, name: p.name, position: p.positionId ? (positionName.get(p.positionId) ?? null) : null, days: input.days.map(() => []) };
    group.rows.set(p.employeeId, row);
    row.days[dayIndex.get(s.workDate)!]!.push(cellOf(s));
  }
  const order = new Map(people.map((p, i) => [p.employeeId, i]));
  const out: ExportGroup[] = [...groups.entries()]
    .sort((a, b) => a[1].order.localeCompare(b[1].order, "pt"))
    .map(([key, g]) => ({ key, title: input.groupBy === "employee" ? null : g.title, rows: [...g.rows.values()].sort((a, b) => order.get(a.employeeId)! - order.get(b.employeeId)!) }));

  // Legenda: todas as siglas efetivamente usadas (uma vez cada).
  const legend = new Map<string, ExportLegendItem>();
  for (const g of out) for (const r of g.rows) for (const day of r.days) for (const c of day) if (!legend.has(c.code)) legend.set(c.code, { code: c.code, name: c.name, time: c.time, color: c.color });
  const everyone = new Set(out.flatMap((g) => g.rows.map((r) => r.employeeId)));
  return {
    days: input.days,
    groupBy: input.groupBy,
    groups: out,
    legend: [...legend.values()].sort((a, b) => (a.code === "F" ? 1 : b.code === "F" ? -1 : a.code.localeCompare(b.code, "pt"))),
    individual: everyone.size === 1 && f.employeeIds?.length === 1,
    hasDraft: live.some(isDraft),
    assignments: live.length,
  };
}
