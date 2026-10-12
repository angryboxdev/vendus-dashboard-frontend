import { useEffect } from "react";

/** Quanto tempo o aviso "Desfazer" fica no ecrã (o servidor aceita até 15 min). */
export const UNDO_TOAST_MS = 15_000;

export interface UndoToastState {
  message: string;
  /** null = aviso só informativo (ex.: depois de desfazer). */
  undoToken: string | null;
}

/** Aviso flutuante logo a seguir a apagar — "Desfazer" repõe os turnos apagados. */
export function UndoToast({ state, busy, onUndo, onClose }: { state: UndoToastState; busy: boolean; onUndo: (token: string) => void; onClose: () => void }) {
  useEffect(() => {
    if (busy) return;
    const t = window.setTimeout(onClose, UNDO_TOAST_MS);
    return () => window.clearTimeout(t);
  }, [state, busy, onClose]);

  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-xl bg-stone-900 px-4 py-3 text-sm text-white shadow-lg">
      <span>{state.message}</span>
      {state.undoToken && (
        <button type="button" disabled={busy} onClick={() => onUndo(state.undoToken!)} className="font-semibold text-[#F5C992] hover:underline disabled:opacity-60">
          {busy ? "A desfazer…" : "Desfazer"}
        </button>
      )}
      <button type="button" onClick={onClose} aria-label="Fechar aviso" className="text-stone-400 hover:text-white">
        ✕
      </button>
    </div>
  );
}
