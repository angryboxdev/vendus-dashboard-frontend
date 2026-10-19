/**
 * Edição direta na grelha da escala: células (pessoa × dia), seleção em
 * retângulo ao arrastar e o plano de cópia de um turno para outras células.
 * Só apresentação/composição: as regras (sobreposições, descansos, bloqueios)
 * continuam a ser decididas pela API em cada turno criado.
 */
import type { RosterShift, ShiftInput } from "../entities/rosters.ts";

export interface CellRef {
  employeeId: string;
  workDate: string;
}

export const cellKey = (c: CellRef) => `${c.employeeId}|${c.workDate}`;

export function parseCellKey(key: string): CellRef {
  const i = key.lastIndexOf("|");
  return { employeeId: key.slice(0, i), workDate: key.slice(i + 1) };
}

/**
 * Células do retângulo entre `a` e `b` (inclusive), pela ordem da grelha:
 * `people` = linhas visíveis, `days` = colunas. Fora da grelha → só `b`.
 */
export function cellRect(people: string[], days: string[], a: CellRef, b: CellRef): CellRef[] {
  const r1 = people.indexOf(a.employeeId);
  const r2 = people.indexOf(b.employeeId);
  const c1 = days.indexOf(a.workDate);
  const c2 = days.indexOf(b.workDate);
  if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return [b];
  const out: CellRef[] = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++) {
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) out.push({ employeeId: people[r]!, workDate: days[c]! });
  }
  return out;
}

/** Turnos novos iguais a `source` nas células indicadas (sem a do próprio turno, sem repetidos). */
export function copyInputs(source: Pick<RosterShift, "employeeId" | "workDate" | "kind" | "templateId" | "segments" | "areaId">, targets: CellRef[]): ShiftInput[] {
  const seen = new Set<string>([cellKey(source)]);
  const out: ShiftInput[] = [];
  for (const t of targets) {
    const k = cellKey(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      employeeId: t.employeeId,
      workDate: t.workDate,
      kind: source.kind,
      templateId: source.templateId,
      // Com modelo, as faixas vêm do modelo; sem modelo, copiam-se as do turno.
      segments: source.templateId ? [] : source.segments,
      // A área vai com o turno (a do turno de origem).
      areaId: source.kind === "shift" ? (source.areaId ?? null) : null,
    });
  }
  return out;
}

/** Turnos novos do modelo escolhido (ou folga) nas células selecionadas, com a área escolhida (folga nunca tem área). */
export function paintInputs(paint: string, targets: CellRef[], areaId: string | null = null): ShiftInput[] {
  const dayOff = paint === "day_off";
  return targets.map((t) => ({ employeeId: t.employeeId, workDate: t.workDate, kind: dayOff ? "day_off" : "shift", templateId: dayOff ? null : paint, segments: [], areaId: dayOff ? null : areaId }));
}
