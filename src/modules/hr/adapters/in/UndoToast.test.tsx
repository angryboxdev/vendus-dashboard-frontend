import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { UNDO_TOAST_MS, UndoToast } from "./UndoToast.tsx";

describe("UndoToast", () => {
  it("'Desfazer' envia o código da operação", async () => {
    const onUndo = vi.fn();
    render(<UndoToast state={{ message: "3 turno(s) apagado(s).", undoToken: "tok-1" }} busy={false} onUndo={onUndo} onClose={vi.fn()} />);
    expect(screen.getByText("3 turno(s) apagado(s).")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Desfazer" }));
    expect(onUndo).toHaveBeenCalledWith("tok-1");
  });

  it("fecha sozinho ao fim do tempo; aviso informativo não tem 'Desfazer'", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<UndoToast state={{ message: "3 turno(s) reposto(s).", undoToken: null }} busy={false} onUndo={vi.fn()} onClose={onClose} />);
    expect(screen.queryByRole("button", { name: "Desfazer" })).not.toBeInTheDocument();
    act(() => vi.advanceTimersByTime(UNDO_TOAST_MS));
    expect(onClose).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
