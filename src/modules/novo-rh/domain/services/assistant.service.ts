import type { AppliedBatch, ChatTurn } from "../entities/assistant.ts";
import { groupByEmployee, type EditOp } from "./edit-history.service.ts";

/** Regras puras do Assistente Mezza no ecrã (sem React, sem API). */

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "12–18 outubro" · "28 set – 4 out" */
export function periodLabel(from: string, to: string): string {
  const [fm, fd] = [Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10))];
  const [tm, td] = [Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10))];
  if (from === to) return `${fd} ${MONTHS[fm]}`;
  return fm === tm ? `${fd}–${td} ${MONTHS[fm]}` : `${fd} ${SHORT[fm]} – ${td} ${SHORT[tm]}`;
}

export function rosterStateLabel(pending: number): string {
  return pending > 0 ? "Escala em rascunho" : "Escala publicada";
}

/** Distingue clique de arrasto (limiar de ~5 px). */
export const DRAG_THRESHOLD = 5;
export function isDrag(dx: number, dy: number, threshold = DRAG_THRESHOLD): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

/** Histórico enviado ao servidor: as últimas trocas, só texto. */
export const HISTORY_TURNS = 12;
export function historyForServer(turns: ChatTurn[]): ChatTurn[] {
  return turns.slice(-HISTORY_TURNS);
}

/**
 * O lote aplicado pela IA como uma só entrada do Desfazer da escala
 * (mesmo histórico das ações manuais): desfazer retira o criado e repõe o
 * retirado; refazer faz o contrário.
 */
export function aiBatchOp(a: AppliedBatch): EditOp | null {
  const affected = [...a.created.map((c) => c.id), ...a.removed.map((r) => r.id)];
  if (!affected.length) return null;
  return {
    type: "AI_BATCH",
    label: a.label,
    affectedIds: affected,
    inversePayload: { created: groupByEmployee(a.created), removed: a.removed.map((r) => r.id), removedByEmployee: groupByEmployee(a.removed), from: a.from, to: a.to },
  };
}

/** Sugestões iniciais (texto para enviar). */
export const SUGGESTIONS = ["Quem trabalha hoje?", "Quais turnos estão descobertos esta semana?", "Existem conflitos?"];
