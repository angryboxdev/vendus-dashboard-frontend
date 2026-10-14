/**
 * Desfazer / Refazer da escala: só deltas mínimos da sessão (ids dos turnos
 * afetados e o necessário para a operação inversa), nunca uma cópia da
 * escala. Puro: as pilhas são valores; quem executa é o adaptador (com as
 * mutations da API, que revalidam tudo).
 */

/** Ids de turnos agrupados por colaborador (a limpeza em lote é por colaborador). */
export type IdsByEmployee = Record<string, string[]>;

export type EditOp =
  /** Turnos criados (atribuir, colar, copiar). Desfazer = retirar; refazer = repor. */
  | { type: "ASSIGN_SHIFT"; affectedIds: string[]; inversePayload: { byEmployee: IdsByEmployee; from: string; to: string } }
  /** Turno pendente retirado (×). Desfazer = repor; refazer = retirar. */
  | { type: "REMOVE_SHIFT"; affectedIds: string[]; inversePayload: { byEmployee: IdsByEmployee; from: string; to: string } }
  /** Limpeza dos pendentes de um colaborador no período (uma só operação). */
  | { type: "CLEAR_EMPLOYEE_WEEK"; affectedIds: string[]; inversePayload: { employeeId: string; from: string; to: string } }
  /** Turno pendente movido: criado no destino e retirado da origem. */
  | { type: "MOVE_SHIFT"; affectedIds: string[]; inversePayload: { removed: IdsByEmployee; byEmployee: IdsByEmployee; from: string; to: string } }
  /** Lote do Assistente Mezza: o que criou e o que retirou, numa só operação lógica. */
  | { type: "AI_BATCH"; label: string; affectedIds: string[]; inversePayload: { created: IdsByEmployee; removed: string[]; removedByEmployee: IdsByEmployee; from: string; to: string } };

export interface EditHistory {
  undo: EditOp[];
  redo: EditOp[];
}

export const HISTORY_LIMIT = 30;
export const emptyHistory = (): EditHistory => ({ undo: [], redo: [] });

/** Nova operação: entra no topo de "desfazer" (máx. 30) e limpa "refazer". */
export function recordOp(h: EditHistory, op: EditOp): EditHistory {
  if (!op.affectedIds.length) return h;
  return { undo: [...h.undo, op].slice(-HISTORY_LIMIT), redo: [] };
}

/** Depois de desfazer com sucesso: a operação passa para "refazer". */
export function afterUndo(h: EditHistory): EditHistory {
  const op = h.undo.at(-1);
  return op ? { undo: h.undo.slice(0, -1), redo: [...h.redo, op] } : h;
}

/** Depois de refazer com sucesso: volta para "desfazer". */
export function afterRedo(h: EditHistory): EditHistory {
  const op = h.redo.at(-1);
  return op ? { undo: [...h.undo, op].slice(-HISTORY_LIMIT), redo: h.redo.slice(0, -1) } : h;
}

/** Agrupa turnos por colaborador (para as chamadas em lote). */
export function groupByEmployee(shifts: { id: string; employeeId: string }[]): IdsByEmployee {
  const out: IdsByEmployee = {};
  for (const s of shifts) (out[s.employeeId] ??= []).push(s.id);
  return out;
}

export const opLabel: Record<EditOp["type"], string> = {
  ASSIGN_SHIFT: "atribuição",
  REMOVE_SHIFT: "remoção",
  CLEAR_EMPLOYEE_WEEK: "limpeza da semana",
  MOVE_SHIFT: "mudança de turno",
  AI_BATCH: "ação do Assistente Mezza",
};
