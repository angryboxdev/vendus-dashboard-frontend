import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { InboxList, InboxRow } from "../../../domain/entities/inbox.ts";
import { fakeNovoRhModule } from "../../../fake-module.test-utils.ts";
import { NovoRhProvider } from "../../../novo-rh.module.tsx";
import { InboxView } from "./InboxView.tsx";

const row = (key: string, over: Partial<InboxRow> = {}): InboxRow => ({
  key,
  type: key.split(":")[0] as InboxRow["type"],
  id: key.split(":")[1]!,
  employeeId: "e1",
  employeeName: "Ana Demo",
  locationName: "Porto",
  requestedAt: "2026-10-10T09:00:00Z",
  ageDays: 2,
  title: "Férias",
  detail: "2026-10-20 a 2026-10-24 · 5 dia(s)",
  meta: [],
  canDecide: true,
  blockedReason: null,
  level: { current: 1, total: 2 },
  ...over,
});

const LIST: InboxList = {
  types: ["leave", "clock"],
  counters: { leave: { mine: 2, others: 1 }, clock: { mine: 1, others: 0 } },
  items: [
    row("leave:l1", { ageDays: 12, employeeName: "Rui Demo" }),
    row("leave:l2"),
    row("clock:c1", { title: "Correção de ponto", detail: "Acrescentar marcação", level: null }),
    row("leave:l3", { employeeName: "Gestor Demo", canDecide: false, blockedReason: "own" }),
  ],
};

function renderInbox() {
  const mod = fakeNovoRhModule({
    inbox: {
      list: vi.fn(async () => LIST),
      decide: vi.fn(async (keys: string[]) => keys.map((key) => (key === "leave:l2" ? { key, ok: false, code: "period_closed", message: "O dia está num período fechado." } : { key, ok: true }))),
    },
  });
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <NovoRhProvider module={mod} modeStore={{ load: () => "real", save: () => {} }}>
        <MemoryRouter>
          <InboxView />
        </MemoryRouter>
      </NovoRhProvider>
    </QueryClientProvider>,
  );
  return mod;
}

describe("Caixa de pedidos (FE-050)", () => {
  it("tipos com contadores, antiguidade destacada e pedido próprio sem botões (RE-22, RE-24)", async () => {
    renderInbox();
    const nav = await screen.findByRole("navigation", { name: "Tipos de pedido" });
    await vi.waitFor(() => expect(within(nav).getByRole("button", { name: /Todos\s*3/ })).toBeInTheDocument());
    expect(within(nav).getByRole("button", { name: /Ausências\s*2/ })).toBeInTheDocument();
    expect(screen.getByText("há 12 dias").closest("[class*=rounded]")).toBeInTheDocument();
    const own = screen.getByText("Gestor Demo").closest("tr")!;
    expect(within(own).queryByRole("button", { name: "Aprovar" })).not.toBeInTheDocument();
    expect(own).toHaveTextContent("Pedido seu");
  });

  it("recusar exige motivo; lote mostra o resultado por pedido", async () => {
    const mod = renderInbox();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("checkbox", { name: "Selecionar todos" }));
    await user.click(screen.getByRole("button", { name: "Recusar 3" }));
    const dialog = screen.getByRole("dialog");
    const confirm = within(dialog).getByRole("button", { name: "Recusar" });
    expect(confirm).toBeDisabled();
    await user.type(within(dialog).getByLabelText(/Motivo da recusa/), "Sem cobertura no centro");
    await user.click(confirm);
    expect(mod.inbox.decide).toHaveBeenCalledWith(["leave:l1", "leave:l2", "clock:c1"], "reject", "Sem cobertura no centro");
    expect(await screen.findByText("2 decidido(s), 1 por decidir")).toBeInTheDocument();
    expect(screen.getByText(/O dia está num período fechado/)).toBeInTheDocument();
  });

  it("aprovar um pedido não pede motivo", async () => {
    const mod = renderInbox();
    const user = userEvent.setup();
    const r = (await screen.findByText("Rui Demo")).closest("tr")!;
    await user.click(within(r).getByRole("button", { name: "Aprovar" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Aprovar" }));
    expect(mod.inbox.decide).toHaveBeenCalledWith(["leave:l1"], "approve", null);
  });
});
