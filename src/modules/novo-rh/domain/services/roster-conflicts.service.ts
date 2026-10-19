/**
 * Escalas — seletor inteligente de colaboradores e conflitos (regras puras de
 * apresentação). Quem pode trabalhar onde e o que é conflito decide o
 * servidor; aqui só se agrupa, ordena e descreve.
 */
import type { RosterCandidates, Violation } from "../entities/rosters.ts";
import { weekOf } from "./attendance.service.ts";

export interface PickerPerson {
  id: string;
  name: string;
  photoUrl: string | null;
  primaryLocationId: string | null;
}

export interface PickerItem {
  id: string;
  name: string;
  photoUrl: string | null;
  /** Centro de origem (principal da ficha), para mostrar em «Outros centros». */
  locationName: string | null;
  /** Já está na escala (aparece, mas não como nova adição). */
  inRoster: boolean;
  /** Turnos noutras escalas no período (dia, horário, onde). */
  busy: RosterCandidates["busy"];
}

export interface PickerGroups {
  center: PickerItem[];
  others: PickerItem[];
  scheduled: PickerItem[];
}

const norm = (v: string) => v.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/**
 * Três grupos, por esta ordem: do centro/grupo da escala (pertença real do
 * RH); de outros centros sem turnos noutras escalas no período; de outros
 * centros já escalados noutras escalas (continuam selecionáveis — ter turnos
 * noutro centro não é indisponibilidade). A pesquisa (nome ou centro) vale
 * para os três grupos, mesmo recolhidos.
 */
export function pickerGroups(input: {
  people: PickerPerson[];
  inRoster: Set<string>;
  candidates: RosterCandidates | undefined;
  locationName: (id: string | null) => string | null;
  search: string;
}): PickerGroups {
  const members = new Set(input.candidates?.members ?? []);
  const rosterLocation = input.candidates?.roster.targetType === "location" ? input.candidates.roster.targetId : null;
  const busyBy = new Map<string, RosterCandidates["busy"]>();
  for (const b of input.candidates?.busy ?? []) busyBy.set(b.employeeId, [...(busyBy.get(b.employeeId) ?? []), b]);
  const q = norm(input.search.trim());
  const out: PickerGroups = { center: [], others: [], scheduled: [] };
  for (const p of input.people) {
    const item: PickerItem = { id: p.id, name: p.name, photoUrl: p.photoUrl, locationName: input.locationName(p.primaryLocationId), inRoster: input.inRoster.has(p.id), busy: busyBy.get(p.id) ?? [] };
    if (q && !norm(item.name).includes(q) && !norm(item.locationName ?? "").includes(q)) continue;
    if (members.has(p.id) || (rosterLocation !== null && p.primaryLocationId === rosterLocation)) out.center.push(item);
    else if (item.busy.length) out.scheduled.push(item);
    else out.others.push(item);
  }
  const byName = (a: PickerItem, b: PickerItem) => a.name.localeCompare(b.name, "pt");
  const byCenter = (a: PickerItem, b: PickerItem) => (a.locationName ?? "￿").localeCompare(b.locationName ?? "￿", "pt") || byName(a, b);
  out.center.sort(byName);
  out.others.sort(byCenter);
  out.scheduled.sort(byCenter);
  return out;
}

/** «Seg 26/10 09:00–13:00 · Centro Braga» — dias ocupados noutras escalas. */
export function busyLabel(b: RosterCandidates["busy"][number]): string {
  const [, m, d] = b.workDate.split("-");
  const wd = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][new Date(`${b.workDate}T00:00:00Z`).getUTCDay()];
  return `${wd} ${d}/${m} ${b.hours}${b.rosterName ? ` · ${b.rosterName}` : ""}${b.published ? "" : " (rascunho)"}`;
}

// ── Conflitos ────────────────────────────────────────────────────────

export const RULE_LABEL: Record<Violation["rule"], string> = {
  overlap: "Sobreposição",
  min_rest: "Descanso mínimo",
  max_daily: "Máximo diário",
  max_weekly: "Máximo semanal",
  max_annual: "Máximo anual",
  absence: "Ausência aprovada",
};

const ddmm = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;

/** «Semana de 26/10 a 01/11». */
export function weekLabel(ymd: string): string {
  const w = weekOf(ymd);
  return `Semana de ${ddmm(w.from)} a ${ddmm(w.to)}`;
}

export interface ConflictGroup {
  employeeId: string;
  name: string;
  items: Violation[];
  blocking: number;
}

/** Ocorrências agrupadas por colaborador (mais ocorrências primeiro), cada uma por data. */
export function conflictGroups(violations: Violation[], name: (id: string) => string): ConflictGroup[] {
  const by = new Map<string, Violation[]>();
  for (const v of violations) by.set(v.employeeId, [...(by.get(v.employeeId) ?? []), v]);
  return [...by.entries()]
    .map(([employeeId, items]) => ({ employeeId, name: name(employeeId), items: [...items].sort((a, b) => a.workDate.localeCompare(b.workDate) || a.rule.localeCompare(b.rule)), blocking: items.filter((v) => v.severity === "block").length }))
    .sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name, "pt"));
}

/** Resumo: «16 conflitos · 4 colaboradores afetados · Semana de 26/10 a 01/11» (ou «3 semanas»). */
export function conflictSummary(violations: Violation[]): { total: number; blocking: number; employees: number; weeks: string[] } {
  const weeks = [...new Set(violations.map((v) => weekOf(v.workDate).from))].sort();
  return { total: violations.length, blocking: violations.filter((v) => v.severity === "block").length, employees: new Set(violations.map((v) => v.employeeId)).size, weeks };
}

/** Ids dos turnos envolvidos (o afetado e o incompatível) para os destacar na grelha. */
export function conflictShiftIds(violations: Violation[]): Set<string> {
  const ids = new Set<string>();
  for (const v of violations) {
    if (v.shiftId) ids.add(v.shiftId);
    if (v.conflict?.shiftId) ids.add(v.conflict.shiftId);
  }
  return ids;
}

/** Onde abrir um conflito: escala, semana e turno (o próprio ou o incompatível). */
export function conflictTarget(v: Violation, which: "self" | "other", currentRosterId: string): { rosterId: string; weekFrom: string; shiftId: string | null } {
  if (which === "other" && v.conflict) return { rosterId: v.conflict.rosterId ?? currentRosterId, weekFrom: weekOf(v.conflict.workDate).from, shiftId: v.conflict.shiftId };
  return { rosterId: v.rosterId ?? currentRosterId, weekFrom: weekOf(v.workDate).from, shiftId: v.shiftId ?? null };
}
