import { useCallback, useRef, useState } from "react";
import { afterRedo, afterUndo, emptyHistory, opLabel, recordOp, type EditHistory, type EditOp, type IdsByEmployee } from "../../../domain/services/edit-history.service.ts";
import { violationsOf } from "../../../domain/services/rosters.service.ts";
import { useNovoRh } from "../../../novo-rh.module.tsx";

const errorText = (e: unknown) => violationsOf(e)?.violations[0]?.message ?? (e instanceof Error ? e.message : "Erro");

/**
 * Desfazer / Refazer da sessão de edição (memória; não persiste). Executa a
 * operação inversa com as mutations da API (retirar em lote / repor), que
 * revalidam permissões e sobreposições; se o estado mudou entretanto, mostra
 * uma mensagem curta e atualiza os dados.
 */
export function useEditHistory(o: { rosterId: string; refresh: () => Promise<unknown> }) {
  const { rosters } = useNovoRh();
  const [history, setHistory] = useState<EditHistory>(emptyHistory);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const running = useRef(false);

  const record = useCallback((op: EditOp) => setHistory((h) => recordOp(h, op)), []);
  const reset = useCallback(() => {
    setHistory(emptyHistory());
    setMessage(null);
  }, []);

  /** Retira em lote (uma chamada por colaborador), só os ids indicados. */
  const removeIds = async (byEmployee: IdsByEmployee, from: string, to: string) => {
    for (const [employeeId, shiftIds] of Object.entries(byEmployee)) await rosters.clearPending(o.rosterId, { employeeId, from, to, shiftIds });
  };
  const restoreIds = (ids: string[]) => rosters.restoreShifts(o.rosterId, ids);

  const inverse = async (op: EditOp) => {
    switch (op.type) {
      case "ASSIGN_SHIFT":
        return removeIds(op.inversePayload.byEmployee, op.inversePayload.from, op.inversePayload.to);
      case "REMOVE_SHIFT":
      case "CLEAR_EMPLOYEE_WEEK":
        return void (await restoreIds(op.affectedIds));
      case "MOVE_SHIFT":
        await removeIds(op.inversePayload.byEmployee, op.inversePayload.from, op.inversePayload.to);
        return void (await restoreIds(Object.values(op.inversePayload.removed).flat()));
      case "AI_BATCH":
        await removeIds(op.inversePayload.created, op.inversePayload.from, op.inversePayload.to);
        if (op.inversePayload.removed.length) await restoreIds(op.inversePayload.removed);
        return;
    }
  };
  const forward = async (op: EditOp) => {
    switch (op.type) {
      case "ASSIGN_SHIFT":
        return void (await restoreIds(op.affectedIds));
      case "REMOVE_SHIFT":
        return removeIds(op.inversePayload.byEmployee, op.inversePayload.from, op.inversePayload.to);
      case "CLEAR_EMPLOYEE_WEEK":
        return void (await rosters.clearPending(o.rosterId, { ...op.inversePayload, shiftIds: op.affectedIds }));
      case "MOVE_SHIFT":
        await restoreIds(op.affectedIds);
        return removeIds(op.inversePayload.removed, op.inversePayload.from, op.inversePayload.to);
      case "AI_BATCH": {
        // Primeiro retira o antigo (uma alteração de horas no mesmo dia sobreporia), depois repõe o novo.
        await removeIds(op.inversePayload.removedByEmployee, op.inversePayload.from, op.inversePayload.to);
        const created = Object.values(op.inversePayload.created).flat();
        if (created.length) await restoreIds(created);
        return;
      }
    }
  };

  const run = async (dir: "undo" | "redo") => {
    const op = dir === "undo" ? history.undo.at(-1) : history.redo.at(-1);
    if (!op || running.current) return;
    running.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await (dir === "undo" ? inverse(op) : forward(op));
      setHistory(dir === "undo" ? afterUndo : afterRedo);
    } catch (e) {
      // O estado mudou e a operação já não é possível: sai do histórico e atualiza.
      setHistory((h) => (dir === "undo" ? { ...h, undo: h.undo.slice(0, -1) } : { ...h, redo: h.redo.slice(0, -1) }));
      setMessage(`Não foi possível ${dir === "undo" ? "desfazer" : "refazer"} a ${opLabel[op.type]}: ${errorText(e)}`);
    } finally {
      await o.refresh();
      running.current = false;
      setBusy(false);
    }
  };

  return {
    canUndo: history.undo.length > 0 && !busy,
    canRedo: history.redo.length > 0 && !busy,
    undo: () => void run("undo"),
    redo: () => void run("redo"),
    record,
    reset,
    busy,
    message,
    dismiss: () => setMessage(null),
  };
}
