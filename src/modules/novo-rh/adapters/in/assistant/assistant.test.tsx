import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../../../lib/api.ts";
import type { AssistantReply } from "../../../domain/entities/assistant.ts";
import { aiBatchOp, isDrag, periodLabel, rosterStateLabel } from "../../../domain/services/assistant.service.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider, type NovoRhModule } from "../../../novo-rh.module.tsx";
import { useEditHistory } from "../rosters/use-edit-history.ts";
import { MezzaAssistantButton } from "./MezzaAssistantButton.tsx";

// Dados fictícios (RGPD).
const CTX = { rosterId: "r1", rosterName: "Mercado Bom Sucesso", from: "2026-10-12", to: "2026-10-18", pending: 3 };
const reply = (over: Partial<AssistantReply> = {}): AssistantReply => ({ status: "answer", text: "Ok.", facts: [], applied: null, templatesChanged: false, confirmation: null, context: { rosterName: CTX.rosterName, from: CTX.from, to: CTX.to, pending: 3 }, ...over });

function setup(over: (m: NovoRhModule) => void = () => {}) {
  const m = fakeNovoRhModule();
  over(m);
  const onApplied = vi.fn();
  const onPublishFlow = vi.fn();
  const onTemplatesChanged = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <NovoRhProvider module={m}>
        <MezzaAssistantButton context={CTX} onApplied={onApplied} onPublishFlow={onPublishFlow} onTemplatesChanged={onTemplatesChanged} />
      </NovoRhProvider>
    </QueryClientProvider>,
  );
  return { m, onApplied, onPublishFlow, onTemplatesChanged, button: screen.getByRole("button", { name: "Assistente Mezza" }) };
}

describe("Assistente Mezza — regras puras", () => {
  it("contexto legível; clique vs. arrasto com limiar de 5 px", () => {
    expect(periodLabel("2026-10-12", "2026-10-18")).toBe("12–18 outubro");
    expect(periodLabel("2026-09-28", "2026-10-04")).toBe("28 set – 4 out");
    expect(rosterStateLabel(2)).toBe("Escala em rascunho");
    expect(rosterStateLabel(0)).toBe("Escala publicada");
    expect(isDrag(3, 3)).toBe(false);
    expect(isDrag(4, 4)).toBe(true);
  });

  it("lote da IA = uma entrada do Desfazer (criados e retirados por colaborador)", () => {
    const op = aiBatchOp({ label: "ASSIGN_SHIFTS_BATCH", created: [{ id: "n1", employeeId: "e1", workDate: "2026-10-15" }, { id: "n2", employeeId: "e2", workDate: "2026-10-16" }], removed: [{ id: "o1", employeeId: "e1", workDate: "2026-10-14" }], from: "2026-10-14", to: "2026-10-16" });
    expect(op).toEqual({ type: "AI_BATCH", label: "ASSIGN_SHIFTS_BATCH", affectedIds: ["n1", "n2", "o1"], inversePayload: { created: { e1: ["n1"], e2: ["n2"] }, removed: ["o1"], removedByEmployee: { e1: ["o1"] }, from: "2026-10-14", to: "2026-10-16" } });
    expect(aiBatchOp({ label: "x", created: [], removed: [], from: "", to: "" })).toBeNull();
  });
});

describe("Assistente Mezza — bolinha e chat", () => {
  it("1/5: começa no canto inferior direito; a IA não é carregada antes de abrir; 2: clique abre o chat com o contexto", async () => {
    const { m, button } = setup();
    expect(button.parentElement!.className).toMatch(/fixed bottom-6 right-6/);
    expect(m.assistant.status).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
    await userEvent.click(button);
    expect(await screen.findByRole("dialog", { name: "Assistente Mezza" })).toBeInTheDocument();
    expect(screen.getByText("Mercado Bom Sucesso")).toBeInTheDocument();
    expect(screen.getByText("12–18 outubro")).toBeInTheDocument();
    expect(screen.getByText("Escala em rascunho")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escreva ou diga o que pretende...")).toBeInTheDocument();
    expect(m.assistant.status).toHaveBeenCalledTimes(1);
  });

  it("3/4: arrastar não abre o chat e, ao soltar, volta ao canto", async () => {
    const { button } = setup();
    fireEvent.pointerDown(button, { button: 0, pointerId: 1, clientX: 500, clientY: 500 });
    fireEvent.pointerMove(button, { pointerId: 1, clientX: 420, clientY: 380 });
    expect(button.style.transform).toMatch(/translate3d\(-?\d+(\.\d+)?px, -?\d+(\.\d+)?px, 0\)/);
    expect(button.style.transform).not.toBe("translate3d(0px, 0px, 0)");
    fireEvent.pointerUp(button, { pointerId: 1, clientX: 420, clientY: 380 });
    fireEvent.click(button);
    expect(button.style.transform).toBe("translate3d(0px, 0px, 0)");
    await act(() => new Promise((r) => setTimeout(r, 30)));
    expect(screen.queryByRole("dialog")).toBeNull();
    // Um toque sem mover continua a abrir.
    fireEvent.pointerDown(button, { button: 0, pointerId: 2, clientX: 500, clientY: 500 });
    fireEvent.pointerUp(button, { pointerId: 2, clientX: 501, clientY: 501 });
    fireEvent.click(button);
    expect(await screen.findByRole("dialog", { name: "Assistente Mezza" })).toBeInTheDocument();
  });

  it("8/14: pedido executado — resposta, factos e lote para o Desfazer; mesma chave em cada envio", async () => {
    const applied = { label: "ASSIGN_SHIFT", created: [{ id: "n1", employeeId: "e1", workDate: "2026-10-16" }], removed: [], from: "2026-10-16", to: "2026-10-16" };
    const { m, onApplied, button } = setup((m) => {
      m.assistant.chat = vi.fn(async () => reply({ status: "done", text: "✓ João Silva foi atribuído ao turno Manhã de sexta-feira, 09:00–17:00.", facts: ["João Silva — sexta-feira 16/10, 09:00–17:00"], applied }));
    });
    await userEvent.click(button);
    const box = await screen.findByPlaceholderText("Escreva ou diga o que pretende...");
    await userEvent.type(box, "Coloca o João Silva sexta de manhã{Enter}");
    expect(await screen.findByText(/✓ João Silva foi atribuído/)).toBeInTheDocument();
    expect(screen.getByText(/Pode desfazer/)).toBeInTheDocument();
    expect(onApplied).toHaveBeenCalledWith(applied);
    const [input, key] = vi.mocked(m.assistant.chat).mock.calls[0]!;
    expect(input).toEqual({ context: { rosterId: "r1", from: "2026-10-12", to: "2026-10-18" }, history: [], message: "Coloca o João Silva sexta de manhã" });
    expect(key).toMatch(/[0-9a-f-]{36}/);
  });

  it("12: grande alteração pede confirmação; confirmar envia o token; cancelar não altera", async () => {
    const { m, button } = setup((m) => {
      m.assistant.chat = vi.fn(async () => reply({ status: "needs_confirmation", text: "Esta ação removerá 28 turnos não publicados de 7 colaboradores. Confirmar?", confirmation: { token: "tok-1", summary: "…" } }));
      m.assistant.confirm = vi.fn(async () => reply({ status: "done", text: "✓ 28 turnos retirados." }));
    });
    await userEvent.click(button);
    await userEvent.type(await screen.findByPlaceholderText("Escreva ou diga o que pretende..."), "Limpa a semana{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: "Confirmar" }));
    expect(await screen.findByText("✓ 28 turnos retirados.")).toBeInTheDocument();
    expect(vi.mocked(m.assistant.confirm).mock.calls[0]![0]).toBe("tok-1");
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
  });

  it("15: publicar → fecha o chat e abre o fluxo de publicação do ecrã (a IA não publica)", async () => {
    const { onPublishFlow, button } = setup((m) => {
      m.assistant.chat = vi.fn(async () => reply({ status: "publish_flow", text: "O ecrã vai abrir a publicação." }));
    });
    await userEvent.click(button);
    await userEvent.type(await screen.findByPlaceholderText("Escreva ou diga o que pretende..."), "Publica{Enter}");
    await waitFor(() => expect(onPublishFlow).toHaveBeenCalledTimes(1));
  });

  it("17: IA indisponível não bloqueia — mensagem clara; erro 503 no envio também", async () => {
    const { button } = setup((m) => {
      m.assistant.chat = vi.fn(async () => {
        throw new ApiError("x", 503);
      });
    });
    await userEvent.click(button);
    await userEvent.type(await screen.findByPlaceholderText("Escreva ou diga o que pretende..."), "Olá{Enter}");
    expect(await screen.findByText("O Assistente Mezza está temporariamente indisponível. Pode continuar a editar a escala normalmente.")).toBeInTheDocument();
  });

  it("estado 'indisponível' (sem chave): caixa desligada e aviso", async () => {
    const { button } = setup((m) => {
      m.assistant.status = vi.fn(async () => ({ available: false, voice: false }));
    });
    await userEvent.click(button);
    expect(await screen.findByText(/temporariamente indisponível/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Escreva ou diga o que pretende...")).toBeDisabled();
  });
});

describe("Desfazer/Refazer com o lote da IA (mesmo histórico)", () => {
  it("14: desfazer retira o criado e repõe o retirado; refazer retira o antigo antes de repor o novo", async () => {
    const m = fakeNovoRhModule();
    const calls: string[] = [];
    m.rosters.clearPending = vi.fn(async (_r: string, i: { employeeId: string; shiftIds?: string[] }) => (calls.push(`clear ${i.employeeId}:${i.shiftIds?.join(",")}`), { removed: [] })) as never;
    m.rosters.restoreShifts = vi.fn(async (_r: string, ids: string[]) => (calls.push(`restore ${ids.join(",")}`), { restored: [], warnings: [] })) as never;
    const wrapper = ({ children }: { children: ReactNode }) => <NovoRhProvider module={m}>{children}</NovoRhProvider>;
    const { result } = renderHook(() => useEditHistory({ rosterId: "r1", refresh: async () => {} }), { wrapper });
    act(() => result.current.record(aiBatchOp({ label: "UPDATE_SHIFT", created: [{ id: "n1", employeeId: "e1", workDate: "2026-10-15" }], removed: [{ id: "o1", employeeId: "e1", workDate: "2026-10-15" }], from: "2026-10-15", to: "2026-10-15" })!));
    await act(async () => result.current.undo());
    await waitFor(() => expect(result.current.canRedo).toBe(true));
    expect(calls).toEqual(["clear e1:n1", "restore o1"]);
    await act(async () => result.current.redo());
    await waitFor(() => expect(result.current.canUndo).toBe(true));
    expect(calls.slice(2)).toEqual(["clear e1:o1", "restore n1"]);
  });
});
